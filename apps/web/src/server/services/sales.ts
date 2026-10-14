import { and, count, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { saleCreateInput, saleListQuery } from "@/lib/validators";
import type { Database, Executor } from "../db/client";
import { products, saleItems, sales, stockMovements, user } from "../db/schema";
import { AppError } from "../errors";

type SaleInput = z.output<typeof saleCreateInput>;

export interface PricedLine {
  productId: number;
  productName: string;
  barcode: string;
  unitPrice: number;
  unitCost: number;
  quantity: number;
  discount: number;
  lineTotal: number;
}

/**
 * Pure pricing logic: computes the lines and totals of a sale from the
 * catalog prices (never from prices sent by the client).
 */
export function priceSale(
  input: SaleInput,
  catalog: Map<
    number,
    {
      id: number;
      name: string;
      barcode: string;
      salePrice: number;
      costPrice: number;
      stock: number;
      isActive: boolean;
    }
  >,
) {
  // Merge duplicate lines for the same product.
  const merged = new Map<number, { quantity: number; discount: number }>();
  for (const item of input.items) {
    const prev = merged.get(item.productId);
    merged.set(item.productId, {
      quantity: (prev?.quantity ?? 0) + item.quantity,
      discount: (prev?.discount ?? 0) + item.discount,
    });
  }

  const lines: PricedLine[] = [];
  for (const [productId, { quantity, discount }] of merged) {
    const product = catalog.get(productId);
    if (!product) throw new AppError("NOT_FOUND", undefined, { productId });
    if (!product.isActive) {
      throw new AppError("PRODUCT_INACTIVE", undefined, {
        productId,
        name: product.name,
      });
    }
    if (product.stock < quantity) {
      throw new AppError("INSUFFICIENT_STOCK", undefined, {
        productId,
        name: product.name,
        available: product.stock,
        requested: quantity,
      });
    }
    const gross = product.salePrice * quantity;
    if (discount > gross) {
      throw new AppError("INVALID_DISCOUNT", undefined, { productId });
    }
    lines.push({
      productId,
      productName: product.name,
      barcode: product.barcode,
      unitPrice: product.salePrice,
      unitCost: product.costPrice,
      quantity,
      discount,
      lineTotal: gross - discount,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  if (input.discount > subtotal) throw new AppError("INVALID_DISCOUNT");
  const total = subtotal - input.discount;
  const totalCost = lines.reduce((sum, l) => sum + l.unitCost * l.quantity, 0);

  const amountPaid = input.paymentMethod === "cash" ? (input.amountPaid ?? total) : total;
  if (amountPaid < total) {
    throw new AppError("INSUFFICIENT_PAYMENT", undefined, { total, amountPaid });
  }

  return {
    lines,
    subtotal,
    discount: input.discount,
    total,
    totalCost,
    amountPaid,
    changeDue: amountPaid - total,
  };
}

export async function createSale(db: Database, input: SaleInput, userId: string) {
  const saleId = await db.transaction(async (tx) => {
    const ids = [...new Set(input.items.map((i) => i.productId))];
    const rows = await tx
      .select({
        id: products.id,
        name: products.name,
        barcode: products.barcode,
        salePrice: products.salePrice,
        costPrice: products.costPrice,
        stock: products.stock,
        isActive: products.isActive,
      })
      .from(products)
      .where(inArray(products.id, ids));

    const priced = priceSale(input, new Map(rows.map((r) => [r.id, r])));

    const [sale] = await tx
      .insert(sales)
      .values({
        cashierId: userId,
        subtotal: priced.subtotal,
        discount: priced.discount,
        total: priced.total,
        totalCost: priced.totalCost,
        paymentMethod: input.paymentMethod,
        amountPaid: priced.amountPaid,
        changeDue: priced.changeDue,
        note: input.note,
      })
      .returning({ id: sales.id });

    await tx.insert(saleItems).values(priced.lines.map((l) => ({ ...l, saleId: sale.id })));

    for (const line of priced.lines) {
      // Conditional decrement guards against concurrent sales overselling.
      const [updated] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${line.quantity}` })
        .where(and(eq(products.id, line.productId), gte(products.stock, line.quantity)))
        .returning({ stock: products.stock });
      if (!updated) {
        throw new AppError("INSUFFICIENT_STOCK", undefined, {
          productId: line.productId,
          name: line.productName,
        });
      }
      await tx.insert(stockMovements).values({
        productId: line.productId,
        change: -line.quantity,
        stockAfter: updated.stock,
        reason: "sale",
        saleId: sale.id,
        userId,
      });
    }
    return sale.id;
  });

  return getSale(db, saleId);
}

export async function voidSale(db: Database, id: number, userId: string) {
  await db.transaction(async (tx) => {
    const [sale] = await tx
      .update(sales)
      .set({ status: "voided", voidedAt: new Date(), voidedById: userId })
      .where(and(eq(sales.id, id), eq(sales.status, "completed")))
      .returning({ id: sales.id });
    if (!sale) {
      const [exists] = await tx.select({ id: sales.id }).from(sales).where(eq(sales.id, id));
      throw new AppError(exists ? "SALE_ALREADY_VOIDED" : "NOT_FOUND");
    }

    const items = await tx
      .select({ productId: saleItems.productId, quantity: saleItems.quantity })
      .from(saleItems)
      .where(eq(saleItems.saleId, id));

    for (const item of items) {
      if (item.productId === null) continue; // product was deleted
      const [updated] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${item.quantity}` })
        .where(eq(products.id, item.productId))
        .returning({ stock: products.stock });
      if (!updated) continue;
      await tx.insert(stockMovements).values({
        productId: item.productId,
        change: item.quantity,
        stockAfter: updated.stock,
        reason: "void",
        saleId: id,
        userId,
      });
    }
  });
  return getSale(db, id);
}

export async function getSale(db: Executor, id: number) {
  const [sale] = await db
    .select({
      id: sales.id,
      subtotal: sales.subtotal,
      discount: sales.discount,
      total: sales.total,
      totalCost: sales.totalCost,
      paymentMethod: sales.paymentMethod,
      amountPaid: sales.amountPaid,
      changeDue: sales.changeDue,
      note: sales.note,
      status: sales.status,
      voidedAt: sales.voidedAt,
      createdAt: sales.createdAt,
      cashierId: sales.cashierId,
      cashierName: user.name,
    })
    .from(sales)
    .leftJoin(user, eq(sales.cashierId, user.id))
    .where(eq(sales.id, id));
  if (!sale) throw new AppError("NOT_FOUND");

  const items = await db
    .select()
    .from(saleItems)
    .where(eq(saleItems.saleId, id))
    .orderBy(saleItems.id);

  return { ...sale, items };
}

export type SaleDTO = Awaited<ReturnType<typeof getSale>>;

export async function listSales(
  db: Executor,
  query: z.output<typeof saleListQuery>,
  options: { cashierId?: string } = {},
) {
  const filters: SQL[] = [];
  if (query.from) filters.push(gte(sales.createdAt, new Date(query.from)));
  if (query.to) filters.push(lte(sales.createdAt, new Date(query.to)));
  if (query.status) filters.push(eq(sales.status, query.status));
  if (query.q) filters.push(eq(sales.id, query.q));
  if (options.cashierId) filters.push(eq(sales.cashierId, options.cashierId));
  const where = filters.length ? and(...filters) : undefined;

  const itemCount = sql<number>`(select coalesce(sum(${saleItems.quantity}), 0) from ${saleItems} where ${saleItems.saleId} = ${sales.id})`;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: sales.id,
        total: sales.total,
        totalCost: sales.totalCost,
        discount: sales.discount,
        paymentMethod: sales.paymentMethod,
        status: sales.status,
        createdAt: sales.createdAt,
        cashierName: user.name,
        itemCount,
      })
      .from(sales)
      .leftJoin(user, eq(sales.cashierId, user.id))
      .where(where)
      .orderBy(desc(sales.createdAt), desc(sales.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(sales).where(where),
  ]);

  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
