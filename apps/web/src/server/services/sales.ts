import { and, count, desc, eq, gte, inArray, isNull, like, lte, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { saleCreateInput, saleListQuery } from "@/lib/validators";
import type { Ctx } from "../context";
import type { Database, Executor } from "../db/client";
import {
  customers,
  products,
  returnItems,
  saleItems,
  saleReturns,
  sales,
  stores,
} from "../db/schema";
import { col } from "../db/sql";
import { AppError } from "../errors";
import { isMeasured, lineAmount, round3 } from "@/lib/quantity";
import { allocate, includedTax } from "@/lib/tax";
import { getCustomer } from "./customers";
import { findOpenShift } from "./shifts";
import { moveStock } from "./stock";

type SaleInput = z.output<typeof saleCreateInput>;

export type CatalogEntry = {
  id: string;
  name: string;
  barcode: string;
  salePrice: number;
  costPrice: number;
  stock: number;
  isActive: boolean;
  unit: string;
  /** VAT rate override (percent); null uses the store's rate. */
  taxRate?: number | null;
  /** Services have no stock; open-price products take the typed price. */
  kind?: string;
  openPrice?: boolean;
};

/** The store's VAT settings (off: no VAT on the sale). */
export type SaleTax = { enabled: boolean; rate: number };

export interface PricedLine {
  productId: string;
  productName: string;
  barcode: string;
  unitPrice: number;
  unitCost: number;
  quantity: number;
  discount: number;
  lineTotal: number;
  taxRate: number;
  taxAmount: number;
}

/**
 * Pure pricing logic: computes the lines and totals of a sale from the
 * catalog prices (never from prices sent by the client).
 */
export function priceSale(
  input: SaleInput,
  catalog: Map<string, CatalogEntry>,
  tax: SaleTax = { enabled: false, rate: 0 },
) {
  // Merge duplicate lines for the same product (and the same typed price).
  const merged = new Map<
    string,
    { productId: string; quantity: number; discount: number; unitPrice?: number }
  >();
  for (const item of input.items) {
    const key = `${item.productId}|${item.unitPrice ?? ""}`;
    const prev = merged.get(key);
    merged.set(key, {
      productId: item.productId,
      quantity: round3((prev?.quantity ?? 0) + item.quantity),
      discount: (prev?.discount ?? 0) + item.discount,
      unitPrice: item.unitPrice,
    });
  }
  // Stock is checked per product, over all its lines.
  const wanted = new Map<string, number>();
  for (const m of merged.values()) {
    wanted.set(m.productId, round3((wanted.get(m.productId) ?? 0) + m.quantity));
  }

  const lines: PricedLine[] = [];
  for (const { productId, quantity, discount, unitPrice } of merged.values()) {
    const product = catalog.get(productId);
    if (!product) throw new AppError("NOT_FOUND", undefined, { productId });
    if (!product.isActive) {
      throw new AppError("PRODUCT_INACTIVE", undefined, { productId, name: product.name });
    }
    if (!isMeasured(product.unit) && !Number.isInteger(quantity)) {
      throw new AppError("QUANTITY_WHOLE", undefined, { productId, name: product.name });
    }
    const requested = wanted.get(productId) ?? quantity;
    if (product.kind !== "service" && round3(product.stock - requested) < 0) {
      throw new AppError("INSUFFICIENT_STOCK", undefined, {
        productId,
        name: product.name,
        available: product.stock,
        requested,
      });
    }
    // Only open-price products take the price typed at the till.
    const price = product.openPrice && unitPrice !== undefined ? unitPrice : product.salePrice;
    const gross = lineAmount(price, quantity);
    if (discount > gross) throw new AppError("INVALID_DISCOUNT", undefined, { productId });
    lines.push({
      productId,
      productName: product.name,
      barcode: product.barcode,
      unitPrice: price,
      unitCost: product.costPrice,
      quantity,
      discount,
      lineTotal: gross - discount,
      taxRate: tax.enabled ? (product.taxRate ?? tax.rate) : 0,
      taxAmount: 0,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  if (input.discount > subtotal) throw new AppError("INVALID_DISCOUNT");
  const total = subtotal - input.discount;
  // VAT is included in the prices: extract it from each line once its share
  // of the ticket discount is taken off.
  const shares = allocate(
    input.discount,
    lines.map((l) => l.lineTotal),
  );
  lines.forEach((l, i) => {
    l.taxAmount = includedTax(l.lineTotal - shares[i], l.taxRate);
  });
  const taxTotal = lines.reduce((sum, l) => sum + l.taxAmount, 0);
  const totalCost = lines.reduce((sum, l) => sum + lineAmount(l.unitCost, l.quantity), 0);

  let amountPaid: number;
  if (input.paymentMethod === "credit") {
    amountPaid = input.amountPaid ?? 0; // optional down payment
  } else if (input.paymentMethod === "cash") {
    amountPaid = input.amountPaid ?? total;
  } else {
    amountPaid = total; // card / other: charged exactly
  }

  const onAccount = Math.max(0, total - amountPaid);
  if (onAccount > 0 && !input.customerId) {
    // Paying less than the total is only allowed on a customer's account.
    throw input.paymentMethod === "credit"
      ? new AppError("CUSTOMER_REQUIRED")
      : new AppError("INSUFFICIENT_PAYMENT", undefined, { total, amountPaid });
  }

  return {
    lines,
    subtotal,
    discount: input.discount,
    total,
    taxTotal,
    totalCost,
    amountPaid,
    changeDue: Math.max(0, amountPaid - total),
    balanceDue: onAccount,
  };
}

/** Next receipt sequence number for this device in this store. */
async function nextSeq(db: Executor, storeId: string, deviceCode: string) {
  const [row] = await db
    .select({ max: sql<number | null>`max(${sales.seq})` })
    .from(sales)
    .where(and(eq(sales.storeId, storeId), eq(sales.deviceCode, deviceCode)));
  return (row?.max ?? 0) + 1;
}

export async function createSale(
  db: Database,
  ctx: Ctx,
  input: SaleInput,
  options: { deviceCode: string; shiftsEnabled?: boolean },
) {
  const [store] = await db.select().from(stores).where(eq(stores.id, ctx.storeId));
  if (!store) throw new AppError("NOT_FOUND");
  const shift = await findOpenShift(db, ctx);
  // A plan without cash shifts never requires one.
  if (store.requireShift && options.shiftsEnabled !== false && !shift) {
    throw new AppError("SHIFT_REQUIRED");
  }

  const customer = input.customerId ? await getCustomer(db, ctx, input.customerId) : null;

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
        unit: products.unit,
        taxRate: products.taxRate,
        kind: products.kind,
        openPrice: products.openPrice,
      })
      .from(products)
      .where(
        and(
          inArray(products.id, ids),
          eq(products.storeId, ctx.storeId),
          isNull(products.deletedAt),
        ),
      );

    const priced = priceSale(input, new Map(rows.map((r) => [r.id, r])), {
      enabled: store.taxEnabled,
      rate: store.taxRate,
    });

    if (customer && priced.balanceDue > 0 && customer.creditLimit !== null) {
      if (customer.balance + priced.balanceDue > customer.creditLimit) {
        throw new AppError("CREDIT_LIMIT_EXCEEDED", undefined, {
          balance: customer.balance,
          creditLimit: customer.creditLimit,
        });
      }
    }

    const [sale] = await tx
      .insert(sales)
      .values({
        storeId: ctx.storeId,
        deviceCode: options.deviceCode,
        seq: await nextSeq(tx, ctx.storeId, options.deviceCode),
        cashierId: ctx.userId,
        cashierName: ctx.userName,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? null,
        shiftId: shift?.id ?? null,
        subtotal: priced.subtotal,
        discount: priced.discount,
        total: priced.total,
        taxTotal: priced.taxTotal,
        totalCost: priced.totalCost,
        paymentMethod: input.paymentMethod,
        amountPaid: priced.amountPaid,
        changeDue: priced.changeDue,
        balanceDue: priced.balanceDue,
        note: input.note,
      })
      .returning({ id: sales.id });

    await tx
      .insert(saleItems)
      .values(priced.lines.map((l) => ({ ...l, saleId: sale.id, storeId: ctx.storeId })));

    for (const line of priced.lines) {
      const moved = await moveStock(tx, ctx, {
        productId: line.productId,
        change: -line.quantity,
        reason: "sale",
        refId: sale.id,
        requireAvailable: true,
      });
      if (!moved) {
        throw new AppError("INSUFFICIENT_STOCK", undefined, {
          productId: line.productId,
          name: line.productName,
        });
      }
    }
    return sale.id;
  });

  return getSale(db, ctx, saleId);
}

export async function voidSale(db: Database, ctx: Ctx, id: string) {
  await db.transaction(async (tx) => {
    const [{ returns }] = await tx
      .select({ returns: count() })
      .from(saleReturns)
      .where(eq(saleReturns.saleId, id));
    if (returns > 0) throw new AppError("SALE_HAS_RETURNS");

    const [sale] = await tx
      .update(sales)
      .set({
        status: "voided",
        voidedAt: new Date(),
        voidedById: ctx.userId,
        voidedByName: ctx.userName,
      })
      .where(and(eq(sales.id, id), eq(sales.storeId, ctx.storeId), eq(sales.status, "completed")))
      .returning({ id: sales.id });
    if (!sale) {
      const [exists] = await tx
        .select({ id: sales.id })
        .from(sales)
        .where(and(eq(sales.id, id), eq(sales.storeId, ctx.storeId)));
      throw new AppError(exists ? "SALE_ALREADY_VOIDED" : "NOT_FOUND");
    }

    const items = await tx
      .select({ productId: saleItems.productId, quantity: saleItems.quantity })
      .from(saleItems)
      .where(eq(saleItems.saleId, id));
    for (const item of items) {
      if (!item.productId) continue;
      await moveStock(tx, ctx, {
        productId: item.productId,
        change: item.quantity,
        reason: "void",
        refId: id,
      });
    }
  });
  return getSale(db, ctx, id);
}

export async function getSale(db: Executor, ctx: Ctx, id: string) {
  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, id), eq(sales.storeId, ctx.storeId)));
  if (!sale) throw new AppError("NOT_FOUND");

  const items = await db
    .select()
    .from(saleItems)
    .where(eq(saleItems.saleId, id))
    .orderBy(saleItems.id);

  const returned = await db
    .select({
      saleItemId: returnItems.saleItemId,
      quantity: sql<number>`sum(${returnItems.quantity})`,
      refund: sql<number>`sum(${returnItems.refundAmount})`,
    })
    .from(returnItems)
    .innerJoin(saleReturns, eq(saleReturns.id, returnItems.returnId))
    .where(eq(saleReturns.saleId, id))
    .groupBy(returnItems.saleItemId);
  const returnedBy = new Map(returned.map((r) => [r.saleItemId, Number(r.quantity)]));

  const returns = await db
    .select()
    .from(saleReturns)
    .where(eq(saleReturns.saleId, id))
    .orderBy(saleReturns.createdAt);

  // Units come from the products (pieces when a product was deleted).
  const productIds = items.map((i) => i.productId).filter((v): v is string => Boolean(v));
  const unitOf = new Map(
    productIds.length
      ? (
          await db
            .select({ id: products.id, unit: products.unit })
            .from(products)
            .where(inArray(products.id, productIds))
        ).map((p) => [p.id, p.unit])
      : [],
  );

  return {
    ...sale,
    number: `${sale.deviceCode}-${sale.seq}`,
    items: items.map((i) => ({
      ...i,
      unit: unitOf.get(i.productId ?? "") ?? "piece",
      returnedQuantity: returnedBy.get(i.id) ?? 0,
    })),
    returns,
    refundedAmount: returns.reduce((s, r) => s + r.refundAmount, 0),
  };
}

export type SaleDTO = Awaited<ReturnType<typeof getSale>>;

export async function listSales(
  db: Executor,
  ctx: Ctx,
  query: z.output<typeof saleListQuery>,
  options: { cashierId?: string } = {},
) {
  const filters: (SQL | undefined)[] = [eq(sales.storeId, ctx.storeId)];
  if (query.from) filters.push(gte(sales.createdAt, new Date(query.from)));
  if (query.to) filters.push(lte(sales.createdAt, new Date(query.to)));
  if (query.status) filters.push(eq(sales.status, query.status));
  if (query.customerId) filters.push(eq(sales.customerId, query.customerId));
  if (query.q) {
    const q = query.q.toUpperCase();
    const m = /^([A-Z0-9]+)-(\d+)$/.exec(q);
    if (m) filters.push(and(eq(sales.deviceCode, m[1]), eq(sales.seq, Number(m[2]))));
    else if (/^\d+$/.test(q)) filters.push(eq(sales.seq, Number(q)));
    else filters.push(like(customers.name, `%${query.q}%`));
  }
  if (options.cashierId) filters.push(eq(sales.cashierId, options.cashierId));
  const where = and(...filters);

  // A weighed or measured line (0.75 kg) counts as one item, like the cart.
  const measured = sql`(select ${products.unit} from ${products} where ${products.id} = ${saleItems.productId}) not in ('piece')`;
  const itemCount = sql<number>`(select coalesce(sum(case when ${measured} then 1 else ${saleItems.quantity} end), 0) from ${saleItems} where ${saleItems.saleId} = ${col("sales", "id")})`;
  const refunded = sql<number>`(select coalesce(sum(${saleReturns.refundAmount}), 0) from ${saleReturns} where ${saleReturns.saleId} = ${col("sales", "id")})`;
  // Returns are kept apart from the ticket: the list shows them next to it.
  const returnedCount = sql<number>`(select coalesce(sum(case when ${measured} then 1 else q end), 0) from (select ${returnItems.saleItemId} as sid, sum(${returnItems.quantity}) as q from ${returnItems} inner join ${saleReturns} on ${saleReturns.id} = ${returnItems.returnId} where ${saleReturns.saleId} = ${col("sales", "id")} group by ${returnItems.saleItemId}) r inner join ${saleItems} on ${saleItems.id} = r.sid)`;
  const restockedCost = sql<number>`(select coalesce(sum(${saleReturns.restockedCost}), 0) from ${saleReturns} where ${saleReturns.saleId} = ${col("sales", "id")})`;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: sales.id,
        deviceCode: sales.deviceCode,
        seq: sales.seq,
        total: sales.total,
        totalCost: sales.totalCost,
        discount: sales.discount,
        balanceDue: sales.balanceDue,
        paymentMethod: sales.paymentMethod,
        status: sales.status,
        createdAt: sales.createdAt,
        cashierName: sales.cashierName,
        customerName: sales.customerName,
        itemCount,
        refunded,
        returnedCount,
        restockedCost,
      })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .where(where)
      .orderBy(desc(sales.createdAt), desc(sales.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ total: count() })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .where(where),
  ]);

  return {
    rows: rows.map((r) => ({
      ...r,
      number: `${r.deviceCode}-${r.seq}`,
      itemCount: Number(r.itemCount),
      refunded: Number(r.refunded),
      returnedCount: Number(r.returnedCount),
      restockedCost: Number(r.restockedCost),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
