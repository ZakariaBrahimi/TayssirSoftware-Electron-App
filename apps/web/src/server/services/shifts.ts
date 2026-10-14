import { and, count, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import type { cashMovementInput, shiftCloseInput, shiftOpenInput } from "@/lib/validators";
import type { Ctx } from "../context";
import type { Database, Executor } from "../db/client";
import { cashMovements, customerPayments, saleReturns, sales, shifts } from "../db/schema";
import { AppError } from "../errors";

/** The open shift of the current user, if any. */
export async function findOpenShift(db: Executor, ctx: Ctx) {
  if (!ctx.userId) return null;
  const [row] = await db
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.storeId, ctx.storeId),
        eq(shifts.status, "open"),
        eq(shifts.openedById, ctx.userId),
      ),
    )
    .orderBy(desc(shifts.createdAt))
    .limit(1);
  return row ?? null;
}

export async function openShift(db: Executor, ctx: Ctx, input: z.output<typeof shiftOpenInput>) {
  if (await findOpenShift(db, ctx)) throw new AppError("SHIFT_ALREADY_OPEN");
  const [row] = await db
    .insert(shifts)
    .values({
      storeId: ctx.storeId,
      openingCash: input.openingCash,
      openedById: ctx.userId,
      openedByName: ctx.userName,
    })
    .returning();
  return getShiftSummary(db, ctx, row.id);
}

/**
 * Z-report figures of a shift. Expected cash in the drawer:
 *   opening cash
 * + cash kept from cash sales (amount handed over − change given)
 * + cash handed over on credit sales (partial payments)
 * + cash received as customer payments
 * − cash refunded
 * + pay-ins − pay-outs
 */
export async function getShiftSummary(db: Executor, ctx: Ctx, shiftId: string) {
  const [shift] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, shiftId), eq(shifts.storeId, ctx.storeId)));
  if (!shift) throw new AppError("NOT_FOUND");

  const inShift = and(eq(sales.shiftId, shiftId), eq(sales.status, "completed"));

  const byMethod = await db
    .select({
      method: sales.paymentMethod,
      count: count(),
      total: sql<number>`coalesce(sum(${sales.total}), 0)`,
      cashKept: sql<number>`coalesce(sum(${sales.amountPaid} - ${sales.changeDue}), 0)`,
    })
    .from(sales)
    .where(inShift)
    .groupBy(sales.paymentMethod);

  const [voided] = await db
    .select({ count: count() })
    .from(sales)
    .where(and(eq(sales.shiftId, shiftId), eq(sales.status, "voided")));

  const payments = await db
    .select({
      method: customerPayments.method,
      total: sql<number>`coalesce(sum(${customerPayments.amount}), 0)`,
    })
    .from(customerPayments)
    .where(eq(customerPayments.shiftId, shiftId))
    .groupBy(customerPayments.method);

  const refunds = await db
    .select({
      method: saleReturns.refundMethod,
      total: sql<number>`coalesce(sum(${saleReturns.refundAmount}), 0)`,
    })
    .from(saleReturns)
    .where(eq(saleReturns.shiftId, shiftId))
    .groupBy(saleReturns.refundMethod);

  const movements = await db
    .select()
    .from(cashMovements)
    .where(eq(cashMovements.shiftId, shiftId))
    .orderBy(cashMovements.createdAt);

  const num = (v: unknown) => Number(v ?? 0);
  const salesTotal = byMethod.reduce((s, r) => s + num(r.total), 0);
  const cashFromSales = byMethod
    .filter((r) => r.method === "cash" || r.method === "credit")
    .reduce((s, r) => s + num(r.cashKept), 0);
  const cashPayments = num(payments.find((p) => p.method === "cash")?.total);
  const cashRefunds = num(refunds.find((r) => r.method === "cash")?.total);
  const payIns = movements.filter((m) => m.type === "in").reduce((s, m) => s + m.amount, 0);
  const payOuts = movements.filter((m) => m.type === "out").reduce((s, m) => s + m.amount, 0);
  const expectedCash =
    shift.openingCash + cashFromSales + cashPayments - cashRefunds + payIns - payOuts;

  return {
    shift,
    salesCount: byMethod.reduce((s, r) => s + r.count, 0),
    voidedCount: voided.count,
    salesTotal,
    salesByMethod: byMethod.map((r) => ({ method: r.method, count: r.count, total: num(r.total) })),
    paymentsByMethod: payments.map((p) => ({ method: p.method, total: num(p.total) })),
    refundsByMethod: refunds.map((r) => ({ method: r.method, total: num(r.total) })),
    cashFromSales,
    cashPayments,
    cashRefunds,
    payIns,
    payOuts,
    movements,
    expectedCash: shift.status === "closed" ? (shift.expectedCash ?? expectedCash) : expectedCash,
    difference:
      shift.status === "closed" && shift.countedCash !== null
        ? shift.countedCash - (shift.expectedCash ?? expectedCash)
        : null,
  };
}

export type ShiftSummary = Awaited<ReturnType<typeof getShiftSummary>>;

export async function currentShift(db: Executor, ctx: Ctx) {
  const shift = await findOpenShift(db, ctx);
  return shift ? getShiftSummary(db, ctx, shift.id) : null;
}

export async function closeShift(
  db: Database,
  ctx: Ctx,
  input: z.output<typeof shiftCloseInput>,
) {
  const shift = await findOpenShift(db, ctx);
  if (!shift) throw new AppError("NO_OPEN_SHIFT");
  const summary = await getShiftSummary(db, ctx, shift.id);
  await db
    .update(shifts)
    .set({
      status: "closed",
      closedAt: new Date(),
      closedById: ctx.userId,
      closedByName: ctx.userName,
      expectedCash: summary.expectedCash,
      countedCash: input.countedCash,
      note: input.note,
    })
    .where(eq(shifts.id, shift.id));
  return getShiftSummary(db, ctx, shift.id);
}

export async function addCashMovement(
  db: Executor,
  ctx: Ctx,
  input: z.output<typeof cashMovementInput>,
) {
  const shift = await findOpenShift(db, ctx);
  if (!shift) throw new AppError("NO_OPEN_SHIFT");
  await db.insert(cashMovements).values({
    storeId: ctx.storeId,
    shiftId: shift.id,
    type: input.type,
    amount: input.amount,
    reason: input.reason,
    userId: ctx.userId,
    userName: ctx.userName,
  });
  return getShiftSummary(db, ctx, shift.id);
}

export async function listShifts(
  db: Executor,
  ctx: Ctx,
  query: { page: number; pageSize: number },
  options: { userId?: string } = {},
) {
  const where = and(
    eq(shifts.storeId, ctx.storeId),
    options.userId ? eq(shifts.openedById, options.userId) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(shifts)
      .where(where)
      .orderBy(desc(shifts.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(shifts).where(where),
  ]);
  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
