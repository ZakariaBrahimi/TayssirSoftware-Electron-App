import { and, asc, count, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { CustomerInput, PaymentInput, partyListQuery } from "@/lib/validators";
import type { Ctx } from "../context";
import type { Database, Executor } from "../db/client";
import { customerPayments, customers, saleReturns, sales } from "../db/schema";
import { col } from "../db/sql";
import { AppError } from "../errors";
import { findOpenShift } from "./shifts";

const live = (ctx: Ctx) => and(eq(customers.storeId, ctx.storeId), isNull(customers.deletedAt));

/**
 * What the customer owes (positive) or has as store credit (negative):
 *   unpaid parts of completed sales
 * − payments received
 * − returns refunded to the customer's account
 */
export const customerBalanceSql = sql<number>`(
  coalesce((select sum(${sales.balanceDue}) from ${sales}
    where ${sales.customerId} = ${col("customers", "id")} and ${sales.status} = 'completed'), 0)
  - coalesce((select sum(${customerPayments.amount}) from ${customerPayments}
    where ${customerPayments.customerId} = ${col("customers", "id")}), 0)
  - coalesce((select sum(${saleReturns.refundAmount}) from ${saleReturns}
    inner join ${sales} on ${col("sales", "id")} = ${col("sale_returns", "sale_id")}
    where ${col("sales", "customer_id")} = ${col("customers", "id")} and ${saleReturns.refundMethod} = 'account'), 0)
)`;

const columns = {
  id: customers.id,
  name: customers.name,
  phone: customers.phone,
  email: customers.email,
  address: customers.address,
  notes: customers.notes,
  creditLimit: customers.creditLimit,
  createdAt: customers.createdAt,
  balance: customerBalanceSql,
};

export async function listCustomers(
  db: Executor,
  ctx: Ctx,
  query: z.output<typeof partyListQuery>,
) {
  const filters: (SQL | undefined)[] = [live(ctx)];
  if (query.q) {
    const term = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(
      sql`(${customers.name} like ${term} escape '\\' or ${customers.phone} like ${term} escape '\\')`,
    );
  }
  if (query.withBalance) filters.push(sql`${customerBalanceSql} <> 0`);
  const where = and(...filters);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(columns)
      .from(customers)
      .where(where)
      .orderBy(asc(customers.name))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(customers).where(where),
  ]);
  const [{ totalBalance }] = await db
    .select({ totalBalance: sql<number>`coalesce(sum(${customerBalanceSql}), 0)` })
    .from(customers)
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

export async function getCustomer(db: Executor, ctx: Ctx, id: string) {
  const [row] = await db
    .select(columns)
    .from(customers)
    .where(and(eq(customers.id, id), live(ctx)));
  if (!row) throw new AppError("NOT_FOUND");
  return { ...row, balance: Number(row.balance) };
}

export type CustomerDTO = Awaited<ReturnType<typeof getCustomer>>;

export async function createCustomer(db: Executor, ctx: Ctx, input: CustomerInput) {
  const [row] = await db
    .insert(customers)
    .values({ ...input, storeId: ctx.storeId })
    .returning({ id: customers.id });
  return getCustomer(db, ctx, row.id);
}

export async function updateCustomer(db: Executor, ctx: Ctx, id: string, input: CustomerInput) {
  const [row] = await db
    .update(customers)
    .set(input)
    .where(and(eq(customers.id, id), live(ctx)))
    .returning({ id: customers.id });
  if (!row) throw new AppError("NOT_FOUND");
  return getCustomer(db, ctx, id);
}

export async function deleteCustomer(db: Executor, ctx: Ctx, id: string) {
  const [row] = await db
    .update(customers)
    .set({ deletedAt: new Date() })
    .where(and(eq(customers.id, id), live(ctx)))
    .returning({ id: customers.id });
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

export async function recordCustomerPayment(
  db: Database,
  ctx: Ctx,
  customerId: string,
  input: z.output<typeof import("@/lib/validators").paymentInput>,
) {
  await getCustomer(db, ctx, customerId);
  const shift = await findOpenShift(db, ctx);
  const [row] = await db
    .insert(customerPayments)
    .values({
      storeId: ctx.storeId,
      customerId,
      shiftId: shift?.id ?? null,
      amount: input.amount,
      method: input.method,
      note: input.note,
      cashierId: ctx.userId,
      cashierName: ctx.userName,
    })
    .returning();
  return row;
}

export type PaymentPayload = PaymentInput;

/** Chronological account statement with a running balance. */
export async function customerStatement(db: Executor, ctx: Ctx, customerId: string) {
  const customer = await getCustomer(db, ctx, customerId);

  const saleRows = await db
    .select({
      id: sales.id,
      date: sales.createdAt,
      deviceCode: sales.deviceCode,
      seq: sales.seq,
      total: sales.total,
      balanceDue: sales.balanceDue,
      status: sales.status,
    })
    .from(sales)
    .where(and(eq(sales.customerId, customerId), eq(sales.storeId, ctx.storeId)));

  const paymentRows = await db
    .select({
      id: customerPayments.id,
      date: customerPayments.createdAt,
      amount: customerPayments.amount,
      method: customerPayments.method,
      note: customerPayments.note,
    })
    .from(customerPayments)
    .where(
      and(eq(customerPayments.customerId, customerId), eq(customerPayments.storeId, ctx.storeId)),
    );

  const returnRows = await db
    .select({
      id: saleReturns.id,
      date: saleReturns.createdAt,
      saleId: saleReturns.saleId,
      amount: saleReturns.refundAmount,
      refundMethod: saleReturns.refundMethod,
    })
    .from(saleReturns)
    .innerJoin(sales, eq(sales.id, saleReturns.saleId))
    .where(and(eq(sales.customerId, customerId), eq(saleReturns.storeId, ctx.storeId)));

  type Entry = {
    id: string;
    date: Date;
    type: "sale" | "payment" | "return";
    reference: string | null;
    /** Increases (+) or decreases (−) what the customer owes. */
    amount: number;
    total: number | null;
    voided: boolean;
  };

  const entries: Entry[] = [
    ...saleRows.map((s) => ({
      id: s.id,
      date: s.date,
      type: "sale" as const,
      reference: `${s.deviceCode}-${s.seq}`,
      amount: s.status === "completed" ? s.balanceDue : 0,
      total: s.total,
      voided: s.status === "voided",
    })),
    ...paymentRows.map((p) => ({
      id: p.id,
      date: p.date,
      type: "payment" as const,
      reference: p.note ?? null,
      amount: -p.amount,
      total: p.amount,
      voided: false,
    })),
    ...returnRows.map((r) => ({
      id: r.id,
      date: r.date,
      type: "return" as const,
      reference: null,
      amount: r.refundMethod === "account" ? -r.amount : 0,
      total: r.amount,
      voided: false,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));

  let running = 0;
  const withBalance = entries.map((e) => {
    running += e.amount;
    return { ...e, balance: running };
  });

  return { customer, entries: withBalance.reverse() };
}

export async function listCustomerOptions(db: Executor, ctx: Ctx, q?: string) {
  const term = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  return db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      creditLimit: customers.creditLimit,
      balance: customerBalanceSql,
    })
    .from(customers)
    .where(
      and(
        live(ctx),
        term
          ? sql`(${customers.name} like ${term} escape '\\' or ${customers.phone} like ${term} escape '\\')`
          : undefined,
      ),
    )
    .orderBy(desc(customers.updatedAt))
    .limit(20);
}
