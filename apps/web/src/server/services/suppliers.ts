import { and, asc, count, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { partyListQuery, paymentInput, SupplierInput } from "@/lib/validators";
import type { Ctx } from "../context";
import type { Executor } from "../db/client";
import { purchases, supplierPayments, suppliers } from "../db/schema";
import { col } from "../db/sql";
import { AppError } from "../errors";

const live = (ctx: Ctx) => and(eq(suppliers.storeId, ctx.storeId), isNull(suppliers.deletedAt));

/** What the store owes the supplier: unpaid parts of purchases − payments. */
export const supplierBalanceSql = sql<number>`(
  coalesce((select sum(${purchases.total} - ${purchases.amountPaid}) from ${purchases}
    where ${purchases.supplierId} = ${col("suppliers", "id")}), 0)
  - coalesce((select sum(${supplierPayments.amount}) from ${supplierPayments}
    where ${supplierPayments.supplierId} = ${col("suppliers", "id")}), 0)
)`;

const columns = {
  id: suppliers.id,
  name: suppliers.name,
  phone: suppliers.phone,
  email: suppliers.email,
  address: suppliers.address,
  notes: suppliers.notes,
  createdAt: suppliers.createdAt,
  balance: supplierBalanceSql,
};

export async function listSuppliers(
  db: Executor,
  ctx: Ctx,
  query: z.output<typeof partyListQuery>,
) {
  const filters: (SQL | undefined)[] = [live(ctx)];
  if (query.q) {
    const term = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(
      sql`(${suppliers.name} like ${term} escape '\\' or ${suppliers.phone} like ${term} escape '\\')`,
    );
  }
  if (query.withBalance) filters.push(sql`${supplierBalanceSql} <> 0`);
  const where = and(...filters);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(columns)
      .from(suppliers)
      .where(where)
      .orderBy(asc(suppliers.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(suppliers).where(where),
  ]);
  const [{ totalBalance }] = await db
    .select({ totalBalance: sql<number>`coalesce(sum(${supplierBalanceSql}), 0)` })
    .from(suppliers)
    .where(live(ctx));
  return {
    rows: rows.map((r) => ({ ...r, balance: Number(r.balance) })),
    total,
    totalBalance: Number(totalBalance),
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getSupplier(db: Executor, ctx: Ctx, id: string) {
  const [row] = await db
    .select(columns)
    .from(suppliers)
    .where(and(eq(suppliers.id, id), live(ctx)));
  if (!row) throw new AppError("NOT_FOUND");
  return { ...row, balance: Number(row.balance) };
}

export async function createSupplier(db: Executor, ctx: Ctx, input: SupplierInput) {
  const [row] = await db
    .insert(suppliers)
    .values({ ...input, storeId: ctx.storeId })
    .returning({ id: suppliers.id });
  return getSupplier(db, ctx, row.id);
}

export async function updateSupplier(db: Executor, ctx: Ctx, id: string, input: SupplierInput) {
  const [row] = await db
    .update(suppliers)
    .set(input)
    .where(and(eq(suppliers.id, id), live(ctx)))
    .returning({ id: suppliers.id });
  if (!row) throw new AppError("NOT_FOUND");
  return getSupplier(db, ctx, id);
}

export async function deleteSupplier(db: Executor, ctx: Ctx, id: string) {
  const [row] = await db
    .update(suppliers)
    .set({ deletedAt: new Date() })
    .where(and(eq(suppliers.id, id), live(ctx)))
    .returning({ id: suppliers.id });
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

export async function recordSupplierPayment(
  db: Executor,
  ctx: Ctx,
  supplierId: string,
  input: z.output<typeof paymentInput>,
) {
  await getSupplier(db, ctx, supplierId);
  const [row] = await db
    .insert(supplierPayments)
    .values({
      storeId: ctx.storeId,
      supplierId,
      amount: input.amount,
      method: input.method,
      note: input.note,
      userId: ctx.userId,
      userName: ctx.userName,
    })
    .returning();
  return row;
}

export async function listSupplierPayments(db: Executor, ctx: Ctx, supplierId: string) {
  return db
    .select()
    .from(supplierPayments)
    .where(
      and(eq(supplierPayments.supplierId, supplierId), eq(supplierPayments.storeId, ctx.storeId)),
    )
    .orderBy(sql`${supplierPayments.createdAt} desc`);
}
