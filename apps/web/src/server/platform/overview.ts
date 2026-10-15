import { and, count, desc, gte, isNull, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { platformPayments, storeActivity, stores, syncDevices } from "../db/schema";
import { col } from "../db/sql";
import { platformCurrency } from "./access";
import { licenseCounts } from "./licenses";
import { STALE_AFTER_MS } from "./devices";
import { type EffectiveStatus, effectiveStatusSql } from "./stores";

const DAY = 86_400_000;

const monthStart = (now: number, offset = 0) => {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1);
};

/** Normalizes the "at" date (a Date column or a raw number) to milliseconds. */
const withTime = <R extends { at: Date | number | null }>(rows: R[]) =>
  rows.map(
    (r) =>
      ({ ...r, at: r.at === null ? null : new Date(r.at).getTime() }) as Omit<R, "at"> & {
        at: number | null;
      },
  );

/** Platform owner dashboard: subscriptions, revenue, growth and what needs attention. */
export async function getOverview(db: Executor, now = Date.now()) {
  const status = effectiveStatusSql(now);
  const paying = sql`${status} in ('active', 'past_due')`;
  const notVoid = isNull(platformPayments.voidedAt);
  const ownerSql = sql<string | null>`(select coalesce(u.display_username, u.username) from "user" u
    where u.store_id = ${col("stores", "id")} and u.role = 'admin' order by u.created_at limit 1)`;
  const endedAt = sql<number | null>`(case when ${stores.subscriptionStatus} = 'trialing'
    then ${stores.trialEndsAt} else ${stores.currentPeriodEnd} end)`;
  const storeFields = {
    id: stores.id,
    name: stores.name,
    plan: stores.plan,
    owner: ownerSql,
    status,
    createdAt: stores.createdAt,
  };

  const [
    byStatus,
    [mrr],
    [thisMonth],
    [lastMonth],
    byMonth,
    signups,
    [active7],
    trialsEnding,
    renewalsDue,
    lapsed,
    recentStores,
    recentPayments,
    licensesSummary,
    [devices],
  ] = await Promise.all([
    db.select({ status, stores: count() }).from(stores).groupBy(status),
    db
      .select({
        amount: sql<number>`coalesce(sum((select p.amount * 1.0 / p.months from ${platformPayments} p
          where p.store_id = ${col("stores", "id")} and p.voided_at is null and p.months > 0
          order by p.created_at desc limit 1)), 0)`,
        unpaid: sql<number>`coalesce(sum(case when not exists (select 1 from ${platformPayments} p
          where p.store_id = ${col("stores", "id")} and p.voided_at is null) then 1 else 0 end), 0)`,
      })
      .from(stores)
      .where(paying),
    db
      .select({ amount: sql<number>`coalesce(sum(${platformPayments.amount}), 0)` })
      .from(platformPayments)
      .where(and(notVoid, gte(platformPayments.createdAt, new Date(monthStart(now))))),
    db
      .select({ amount: sql<number>`coalesce(sum(${platformPayments.amount}), 0)` })
      .from(platformPayments)
      .where(
        and(
          notVoid,
          gte(platformPayments.createdAt, new Date(monthStart(now, -1))),
          sql`${platformPayments.createdAt} < ${monthStart(now)}`,
        ),
      ),
    db
      .select({
        month: sql<string>`strftime('%Y-%m', ${platformPayments.createdAt} / 1000, 'unixepoch')`,
        amount: sql<number>`sum(${platformPayments.amount})`,
        payments: count(),
      })
      .from(platformPayments)
      .where(and(notVoid, gte(platformPayments.createdAt, new Date(monthStart(now, -11)))))
      .groupBy(sql`1`),
    db
      .select({
        date: sql<string>`strftime('%Y-%m-%d', ${stores.createdAt} / 1000, 'unixepoch')`,
        stores: count(),
      })
      .from(stores)
      .where(gte(stores.createdAt, new Date(now - 29 * DAY)))
      .groupBy(sql`1`),
    db
      .select({ stores: count() })
      .from(storeActivity)
      .where(gte(storeActivity.lastSeenAt, new Date(now - 7 * DAY))),
    db
      .select({ ...storeFields, at: stores.trialEndsAt })
      .from(stores)
      .where(and(sql`${status} = 'trialing'`, sql`${stores.trialEndsAt} <= ${now + 7 * DAY}`))
      .orderBy(stores.trialEndsAt)
      .limit(10),
    db
      .select({ ...storeFields, at: stores.currentPeriodEnd })
      .from(stores)
      .where(and(paying, sql`${stores.currentPeriodEnd} <= ${now + 7 * DAY}`))
      .orderBy(stores.currentPeriodEnd)
      .limit(10),
    // Ended recently: worth a call before the store is lost.
    db
      .select({ ...storeFields, at: endedAt })
      .from(stores)
      .where(
        and(sql`${status} in ('trial_expired', 'expired')`, sql`${endedAt} >= ${now - 30 * DAY}`),
      )
      .orderBy(desc(endedAt))
      .limit(10),
    db.select(storeFields).from(stores).orderBy(desc(stores.createdAt)).limit(5),
    db
      .select({
        id: platformPayments.id,
        amount: platformPayments.amount,
        currency: platformPayments.currency,
        method: platformPayments.method,
        storeId: platformPayments.storeId,
        storeName: stores.name,
        licenseId: platformPayments.licenseId,
        createdAt: platformPayments.createdAt,
      })
      .from(platformPayments)
      .leftJoin(stores, sql`${stores.id} = ${platformPayments.storeId}`)
      .where(notVoid)
      .orderBy(desc(platformPayments.createdAt))
      .limit(5),
    licenseCounts(db, now),
    db
      .select({
        active: sql<number>`coalesce(sum(case when ${syncDevices.lastSeenAt} >= ${now - STALE_AFTER_MS}
          then 1 else 0 end), 0)`,
        total: count(),
      })
      .from(syncDevices)
      .where(isNull(syncDevices.revokedAt)),
  ]);

  const statusCounts = Object.fromEntries(byStatus.map((r) => [r.status, r.stores])) as Partial<
    Record<EffectiveStatus, number>
  >;
  const totalStores = byStatus.reduce((sum, r) => sum + r.stores, 0);

  return {
    currency: platformCurrency(),
    stores: {
      total: totalStores,
      byStatus: statusCounts,
      paying: (statusCounts.active ?? 0) + (statusCounts.past_due ?? 0),
      activeLast7Days: active7.stores,
      payingWithoutPayment: Number(mrr.unpaid),
    },
    revenue: {
      mrr: Math.round(Number(mrr.amount)),
      thisMonth: Number(thisMonth.amount),
      lastMonth: Number(lastMonth.amount),
      byMonth: byMonth.map((r) => ({ ...r, amount: Number(r.amount) })),
    },
    signups,
    attention: {
      trialsEnding: withTime(trialsEnding),
      renewalsDue: withTime(renewalsDue),
      lapsed: withTime(lapsed),
    },
    recentStores,
    recentPayments,
    licenses: licensesSummary,
    devices: { active: Number(devices.active), total: devices.total },
  };
}
