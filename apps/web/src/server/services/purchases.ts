import { and, count, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { purchaseCreateInput, purchaseListQuery } from "@/lib/validators";
import type { Ctx } from "../context";
import type { Database, Executor } from "../db/client";
import { products, purchaseItems, purchases, supplierPayments } from "../db/schema";
import { col } from "../db/sql";
import { AppError } from "../errors";
import { isMeasured, lineAmount } from "@/lib/quantity";
import { moveStock } from "./stock";
import { getSupplier } from "./suppliers";

/** Weighted average cost after receiving `qty` units at `unitCost`. */
export function weightedAverageCost(
  current: { stock: number; costPrice: number },
  qty: number,
  unitCost: number,
) {
  const onHand = Math.max(0, current.stock);
  if (onHand + qty <= 0) return unitCost;
  return Math.round((onHand * current.costPrice + qty * unitCost) / (onHand + qty));
}

/** Receives goods: adds stock, updates average cost, records what is owed. */
export async function createPurchase(
  db: Database,
  ctx: Ctx,
  input: z.output<typeof purchaseCreateInput>,
) {
  const supplier = input.supplierId ? await getSupplier(db, ctx, input.supplierId) : null;

  const id = await db.transaction(async (tx) => {
    const ids = [...new Set(input.items.map((i) => i.productId))];
    const rows = await tx
      .select()
      .from(products)
      .where(
        and(
          inArray(products.id, ids),
          eq(products.storeId, ctx.storeId),
          isNull(products.deletedAt),
        ),
      );
    const byId = new Map(rows.map((r) => [r.id, r]));

    const lines = input.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) throw new AppError("NOT_FOUND", undefined, { productId: item.productId });
      if (product.kind === "service") {
        throw new AppError("NOT_STOCKED", undefined, { name: product.name });
      }
      if (!isMeasured(product.unit) && !Number.isInteger(item.quantity)) {
        throw new AppError("QUANTITY_WHOLE", undefined, { name: product.name });
      }
      return {
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitCost: item.unitCost,
        lineTotal: lineAmount(item.unitCost, item.quantity),
      };
    });
    const total = lines.reduce((s, l) => s + l.lineTotal, 0);
    const amountPaid = Math.min(input.amountPaid, total);
    if (amountPaid < total && !supplier) {
      // Credit purchases need a supplier to owe the money to.
      throw new AppError("CUSTOMER_REQUIRED", "A supplier is required for unpaid purchases");
    }

    const [purchase] = await tx
      .insert(purchases)
      .values({
        storeId: ctx.storeId,
        supplierId: supplier?.id ?? null,
        supplierName: supplier?.name ?? null,
        reference: input.reference,
        total,
        amountPaid,
        note: input.note,
        userId: ctx.userId,
        userName: ctx.userName,
      })
      .returning({ id: purchases.id });

    await tx
      .insert(purchaseItems)
      .values(lines.map((l) => ({ ...l, storeId: ctx.storeId, purchaseId: purchase.id })));

    for (const line of lines) {
      const [current] = await tx
        .select({ stock: products.stock, costPrice: products.costPrice })
        .from(products)
        .where(eq(products.id, line.productId));
      await tx
        .update(products)
        .set({ costPrice: weightedAverageCost(current, line.quantity, line.unitCost) })
        .where(eq(products.id, line.productId));
      await moveStock(tx, ctx, {
        productId: line.productId,
        change: line.quantity,
        reason: "purchase",
        refId: purchase.id,
      });
    }

    return purchase.id;
  });

  return getPurchase(db, ctx, id);
}

export async function getPurchase(db: Executor, ctx: Ctx, id: string) {
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.id, id), eq(purchases.storeId, ctx.storeId)));
  if (!purchase) throw new AppError("NOT_FOUND");
  const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id));
  return { ...purchase, items };
}

export type PurchaseDTO = Awaited<ReturnType<typeof getPurchase>>;

export async function listPurchases(
  db: Executor,
  ctx: Ctx,
  query: z.output<typeof purchaseListQuery>,
) {
  const filters: (SQL | undefined)[] = [eq(purchases.storeId, ctx.storeId)];
  if (query.supplierId) filters.push(eq(purchases.supplierId, query.supplierId));
  if (query.from) filters.push(gte(purchases.createdAt, new Date(query.from)));
  if (query.to) filters.push(lte(purchases.createdAt, new Date(query.to)));
  const where = and(...filters);
  const itemCount = sql<number>`(select coalesce(sum(${purchaseItems.quantity}), 0) from ${purchaseItems} where ${purchaseItems.purchaseId} = ${col("purchases", "id")})`;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: purchases.id,
        supplierId: purchases.supplierId,
        supplierName: purchases.supplierName,
        reference: purchases.reference,
        total: purchases.total,
        amountPaid: purchases.amountPaid,
        userName: purchases.userName,
        createdAt: purchases.createdAt,
        itemCount,
      })
      .from(purchases)
      .where(where)
      .orderBy(desc(purchases.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(purchases).where(where),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, itemCount: Number(r.itemCount) })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Purchases and payments of a supplier, newest first, with running balance. */
export async function supplierStatement(db: Executor, ctx: Ctx, supplierId: string) {
  const supplier = await getSupplier(db, ctx, supplierId);
  const purchaseRows = await db
    .select()
    .from(purchases)
    .where(and(eq(purchases.supplierId, supplierId), eq(purchases.storeId, ctx.storeId)));
  const paymentRows = await db
    .select()
    .from(supplierPayments)
    .where(
      and(eq(supplierPayments.supplierId, supplierId), eq(supplierPayments.storeId, ctx.storeId)),
    );

  const entries = [
    ...purchaseRows.map((p) => ({
      id: p.id,
      date: p.createdAt,
      type: "purchase" as const,
      reference: p.reference,
      total: p.total,
      amount: p.total - p.amountPaid,
    })),
    ...paymentRows.map((p) => ({
      id: p.id,
      date: p.createdAt,
      type: "payment" as const,
      reference: p.note,
      total: p.amount,
      amount: -p.amount,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));

  let running = 0;
  const withBalance = entries.map((e) => {
    running += e.amount;
    return { ...e, balance: running };
  });
  return { supplier, entries: withBalance.reverse() };
}
