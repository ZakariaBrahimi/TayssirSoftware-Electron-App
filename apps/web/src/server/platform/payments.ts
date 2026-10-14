import { and, count, desc, eq, gte, isNull, lt, sql, type SQL } from "drizzle-orm";
import type { Executor } from "../db/client";
import type { PlatformPaymentMethod } from "@/lib/validators/platform";
import { licenses, platformPayments, stores } from "../db/schema";
import { AppError } from "../errors";
import { type Actor, platformCurrency } from "./access";
import { recordAudit } from "./audit";

export type PaymentMethod = PlatformPaymentMethod;

/** Adds calendar months, clamping to the month's last day (Jan 31 + 1 = Feb 28). */
export function addMonths(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export type RecordPaymentInput = {
  storeId?: string;
  licenseId?: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  plan?: string;
  months: number;
  note?: string;
};

/**
 * Records a payment. For a store, it renews the subscription: the paid
 * months start when the current paid period ends (or today if it already
 * ended). For a license with an end date, it extends that date the same way.
 */
export async function recordPayment(
  db: Executor,
  actor: Actor,
  input: RecordPaymentInput,
  now = Date.now(),
) {
  if (Boolean(input.storeId) === Boolean(input.licenseId)) {
    throw new AppError("VALIDATION_ERROR", "A payment is for a store or a license");
  }
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  let plan = input.plan?.trim() || null;

  if (input.storeId) {
    const [store] = await db.select().from(stores).where(eq(stores.id, input.storeId));
    if (!store) throw new AppError("NOT_FOUND");
    plan ??= store.plan === "trial" ? "standard" : store.plan;
    if (input.months > 0) {
      const paidUntil =
        store.subscriptionStatus !== "trialing" &&
        store.subscriptionStatus !== "canceled" &&
        store.currentPeriodEnd
          ? store.currentPeriodEnd.getTime()
          : 0;
      periodStart = new Date(Math.max(now, paidUntil));
      periodEnd = addMonths(periodStart, input.months);
      await db
        .update(stores)
        .set({ subscriptionStatus: "active", plan, currentPeriodEnd: periodEnd })
        .where(eq(stores.id, store.id));
    }
  } else {
    const [license] = await db.select().from(licenses).where(eq(licenses.id, input.licenseId!));
    if (!license) throw new AppError("NOT_FOUND");
    plan ??= license.plan;
    if (input.months > 0 && license.expiresAt) {
      periodStart = new Date(Math.max(now, license.expiresAt.getTime()));
      periodEnd = addMonths(periodStart, input.months);
      await db.update(licenses).set({ expiresAt: periodEnd }).where(eq(licenses.id, license.id));
    }
  }

  const [payment] = await db
    .insert(platformPayments)
    .values({
      storeId: input.storeId ?? null,
      licenseId: input.licenseId ?? null,
      amount: input.amount,
      currency: platformCurrency(),
      method: input.method,
      reference: input.reference || null,
      plan,
      months: input.months,
      periodStart,
      periodEnd,
      note: input.note || null,
      recordedById: actor.id,
      recordedByName: actor.name,
    })
    .returning();
  await recordAudit(db, actor, {
    action: "payment.create",
    targetType: "payment",
    targetId: payment.id,
    storeId: input.storeId ?? null,
    details: {
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      months: payment.months,
      plan,
      licenseId: input.licenseId ?? null,
      periodEnd: periodEnd?.getTime() ?? null,
    },
  });
  return payment;
}

/**
 * Marks a payment as void (kept for the record, excluded from revenue).
 * Subscription dates are not rolled back: adjust them on the store if needed.
 */
export async function voidPayment(db: Executor, actor: Actor, id: string, reason: string) {
  const [row] = await db
    .update(platformPayments)
    .set({ voidedAt: new Date(), voidedByName: actor.name })
    .where(and(eq(platformPayments.id, id), isNull(platformPayments.voidedAt)))
    .returning();
  if (!row) throw new AppError("NOT_FOUND");
  await recordAudit(db, actor, {
    action: "payment.void",
    targetType: "payment",
    targetId: id,
    storeId: row.storeId,
    details: { amount: row.amount, currency: row.currency, reason },
  });
  return row;
}

export async function listPayments(
  db: Executor,
  query: {
    from?: Date;
    to?: Date;
    storeId?: string;
    licenseId?: string;
    method?: PaymentMethod;
    page: number;
    pageSize: number;
  },
) {
  const filters: (SQL | undefined)[] = [
    query.from ? gte(platformPayments.createdAt, query.from) : undefined,
    query.to ? lt(platformPayments.createdAt, query.to) : undefined,
    query.storeId ? eq(platformPayments.storeId, query.storeId) : undefined,
    query.licenseId ? eq(platformPayments.licenseId, query.licenseId) : undefined,
    query.method ? eq(platformPayments.method, query.method) : undefined,
  ];
  const where = and(...filters);
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: platformPayments.id,
        storeId: platformPayments.storeId,
        storeName: stores.name,
        licenseId: platformPayments.licenseId,
        licenseHint: licenses.keyHint,
        licenseCustomer: licenses.customerName,
        amount: platformPayments.amount,
        currency: platformPayments.currency,
        method: platformPayments.method,
        reference: platformPayments.reference,
        plan: platformPayments.plan,
        months: platformPayments.months,
        periodEnd: platformPayments.periodEnd,
        note: platformPayments.note,
        recordedByName: platformPayments.recordedByName,
        voidedAt: platformPayments.voidedAt,
        createdAt: platformPayments.createdAt,
      })
      .from(platformPayments)
      .leftJoin(stores, eq(stores.id, platformPayments.storeId))
      .leftJoin(licenses, eq(licenses.id, platformPayments.licenseId))
      .where(where)
      .orderBy(desc(platformPayments.createdAt), desc(platformPayments.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({
        total: count(),
        amount: sql<number>`coalesce(sum(case when ${platformPayments.voidedAt} is null
          then ${platformPayments.amount} else 0 end), 0)`,
      })
      .from(platformPayments)
      .where(where),
  ]);
  return {
    rows,
    total: totals.total,
    amount: Number(totals.amount),
    currency: platformCurrency(),
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(totals.total / query.pageSize)),
  };
}
