import { hashPassword } from "better-auth/crypto";
import type { STORE_SORTS, StoreStatus } from "@/lib/validators/platform";
import { and, asc, count, desc, eq, sql, type SQL } from "drizzle-orm";
import type { Executor } from "../db/client";
import {
  account,
  customers,
  platformPayments,
  products,
  sales,
  session,
  storeActivity,
  stores,
  SUBSCRIPTION_STATUSES,
  syncDevices,
  user,
  type SubscriptionStatus,
} from "../db/schema";
import { col } from "../db/sql";
import { AppError } from "../errors";
import type { Actor } from "./access";
import { recordAudit } from "./audit";

const DAY = 86_400_000;

export type EffectiveStatus = StoreStatus;

/**
 * What a store's subscription means right now, combining the stored status
 * with its dates (mirrors licensing/entitlements.ts).
 */
export function effectiveStatusSql(now: number) {
  return sql<EffectiveStatus>`(case
    when ${stores.suspendedAt} is not null then 'suspended'
    when ${stores.subscriptionStatus} = 'trialing' then
      case when ${stores.trialEndsAt} > ${now} then 'trialing' else 'trial_expired' end
    when ${stores.subscriptionStatus} in ('active', 'past_due') then
      case when ${stores.currentPeriodEnd} is null or ${stores.currentPeriodEnd} > ${now}
        then ${stores.subscriptionStatus} else 'expired' end
    else 'canceled' end)`;
}

/** Date that matters next: trial end, or end of the paid period. */
const renewalAtSql = sql<number | null>`(case when ${stores.subscriptionStatus} = 'trialing'
  then ${stores.trialEndsAt} else ${stores.currentPeriodEnd} end)`;

const ownerSql = sql<string | null>`(select coalesce(u.display_username, u.username) from "user" u
  where u.store_id = ${col("stores", "id")} and u.role = 'admin' order by u.created_at limit 1)`;

export async function listStores(
  db: Executor,
  query: {
    q?: string;
    status?: EffectiveStatus;
    sort: (typeof STORE_SORTS)[number];
    page: number;
    pageSize: number;
  },
  now = Date.now(),
) {
  const status = effectiveStatusSql(now);
  const filters: (SQL | undefined)[] = [];
  if (query.q) {
    const term = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(
      sql`(${stores.name} like ${term} escape '\\' or ${stores.id} = ${query.q} or exists (
        select 1 from "user" u where u.store_id = ${col("stores", "id")}
          and (u.username like ${term} escape '\\' or u.name like ${term} escape '\\')))`,
    );
  }
  if (query.status) filters.push(sql`${status} = ${query.status}`);
  const where = and(...filters);

  const lastSeen = sql<number | null>`${storeActivity.lastSeenAt}`;
  const order = {
    "-createdAt": [desc(stores.createdAt)],
    createdAt: [asc(stores.createdAt)],
    name: [asc(stores.name)],
    "-lastSeenAt": [sql`${lastSeen} desc nulls last`],
    renewalAt: [sql`${renewalAtSql} asc nulls last`],
  }[query.sort];

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: stores.id,
        name: stores.name,
        currency: stores.currency,
        plan: stores.plan,
        status,
        renewalAt: renewalAtSql,
        createdAt: stores.createdAt,
        lastSeenAt: lastSeen,
        owner: ownerSql,
        users: sql<number>`(select count(*) from "user" u where u.store_id = ${col("stores", "id")})`,
        devices: sql<number>`(select count(*) from ${syncDevices} d
          where d.store_id = ${col("stores", "id")} and d.revoked_at is null)`,
      })
      .from(stores)
      .leftJoin(storeActivity, eq(storeActivity.storeId, stores.id))
      .where(where)
      .orderBy(...order, asc(stores.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(stores).where(where),
  ]);

  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** Small list for pickers (payments form). */
export async function storeOptions(db: Executor, q: string) {
  const term = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select({ id: stores.id, name: stores.name, plan: stores.plan, owner: ownerSql })
    .from(stores)
    .where(q ? sql`${stores.name} like ${term} escape '\\'` : undefined)
    .orderBy(asc(stores.name))
    .limit(20);
}

async function requireStore(db: Executor, id: string) {
  const [row] = await db.select().from(stores).where(eq(stores.id, id));
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

/**
 * Everything the platform owner needs about one store. Business data is
 * only shown as totals: the owner supports stores, they do not read them.
 */
export async function getStoreDetail(db: Executor, id: string, now = Date.now()) {
  const [store] = await db
    .select({
      id: stores.id,
      name: stores.name,
      address: stores.address,
      phone: stores.phone,
      currency: stores.currency,
      plan: stores.plan,
      subscriptionStatus: stores.subscriptionStatus,
      status: effectiveStatusSql(now),
      trialEndsAt: stores.trialEndsAt,
      currentPeriodEnd: stores.currentPeriodEnd,
      suspendedAt: stores.suspendedAt,
      suspendReason: stores.suspendReason,
      createdAt: stores.createdAt,
      lastSeenAt: storeActivity.lastSeenAt,
    })
    .from(stores)
    .leftJoin(storeActivity, eq(storeActivity.storeId, stores.id))
    .where(eq(stores.id, id));
  if (!store) throw new AppError("NOT_FOUND");

  const since30 = new Date(now - 30 * DAY);
  const [users, devices, payments, [counts], [recent]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        banned: user.banned,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
        // Auth tables store seconds.
        lastLoginAt: sql<number | null>`(select max(s.created_at) * 1000 from ${session} s
          where s.user_id = ${col("user", "id")})`,
      })
      .from(user)
      .where(eq(user.storeId, id))
      .orderBy(asc(user.createdAt)),
    db
      .select({
        id: syncDevices.id,
        name: syncDevices.name,
        deviceCode: syncDevices.deviceCode,
        appVersion: syncDevices.appVersion,
        lastSeenAt: syncDevices.lastSeenAt,
        revokedAt: syncDevices.revokedAt,
        createdAt: syncDevices.createdAt,
      })
      .from(syncDevices)
      .where(eq(syncDevices.storeId, id))
      .orderBy(asc(syncDevices.createdAt)),
    db
      .select()
      .from(platformPayments)
      .where(eq(platformPayments.storeId, id))
      .orderBy(desc(platformPayments.createdAt))
      .limit(50),
    db
      .select({
        products: sql<number>`(select count(*) from ${products} p
          where p.store_id = ${id} and p.deleted_at is null)`,
        customers: sql<number>`(select count(*) from ${customers} c
          where c.store_id = ${id} and c.deleted_at is null)`,
        salesTotal: sql<number>`(select count(*) from ${sales} s
          where s.store_id = ${id} and s.status = 'completed')`,
      })
      .from(sql`(select 1)`),
    db
      .select({
        salesCount: count(),
        revenue: sql<number>`coalesce(sum(${sales.total}), 0)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.storeId, id),
          eq(sales.status, "completed"),
          sql`${sales.createdAt} >= ${since30.getTime()}`,
        ),
      ),
  ]);

  return {
    store,
    users,
    devices,
    payments,
    stats: { ...counts, sales30: recent.salesCount, revenue30: Number(recent.revenue) },
  };
}

export async function setSubscription(
  db: Executor,
  actor: Actor,
  id: string,
  input: { status: SubscriptionStatus; plan?: string; currentPeriodEnd?: Date | null },
) {
  if (!SUBSCRIPTION_STATUSES.includes(input.status)) throw new AppError("VALIDATION_ERROR");
  const before = await requireStore(db, id);
  const [row] = await db
    .update(stores)
    .set({
      subscriptionStatus: input.status,
      ...(input.plan ? { plan: input.plan } : {}),
      ...(input.currentPeriodEnd !== undefined ? { currentPeriodEnd: input.currentPeriodEnd } : {}),
    })
    .where(eq(stores.id, id))
    .returning();
  await recordAudit(db, actor, {
    action: "store.subscription",
    targetType: "store",
    targetId: id,
    storeId: id,
    details: {
      from: {
        status: before.subscriptionStatus,
        plan: before.plan,
        until: before.currentPeriodEnd?.getTime() ?? null,
      },
      to: {
        status: row.subscriptionStatus,
        plan: row.plan,
        until: row.currentPeriodEnd?.getTime() ?? null,
      },
    },
  });
  return row;
}

/** Adds days to the trial (from today when it already ended). */
export async function extendTrial(
  db: Executor,
  actor: Actor,
  id: string,
  days: number,
  now = Date.now(),
) {
  const before = await requireStore(db, id);
  const base = Math.max(now, before.trialEndsAt?.getTime() ?? now);
  const trialEndsAt = new Date(base + days * DAY);
  const [row] = await db
    .update(stores)
    .set({ subscriptionStatus: "trialing", trialEndsAt })
    .where(eq(stores.id, id))
    .returning();
  await recordAudit(db, actor, {
    action: "store.trial_extend",
    targetType: "store",
    targetId: id,
    storeId: id,
    details: { days, until: trialEndsAt.getTime(), previousStatus: before.subscriptionStatus },
  });
  return row;
}

export async function suspendStore(db: Executor, actor: Actor, id: string, reason: string) {
  await requireStore(db, id);
  const [row] = await db
    .update(stores)
    .set({ suspendedAt: new Date(), suspendReason: reason || null })
    .where(eq(stores.id, id))
    .returning();
  await recordAudit(db, actor, {
    action: "store.suspend",
    targetType: "store",
    targetId: id,
    storeId: id,
    details: { reason },
  });
  return row;
}

export async function reactivateStore(db: Executor, actor: Actor, id: string) {
  await requireStore(db, id);
  const [row] = await db
    .update(stores)
    .set({ suspendedAt: null, suspendReason: null })
    .where(eq(stores.id, id))
    .returning();
  await recordAudit(db, actor, {
    action: "store.reactivate",
    targetType: "store",
    targetId: id,
    storeId: id,
  });
  return row;
}

/** Support action: sets a new password for a store user and signs them out. */
export async function resetStoreUserPassword(
  db: Executor,
  actor: Actor,
  storeId: string,
  userId: string,
  password: string,
) {
  const [target] = await db
    .select({ id: user.id, username: user.username })
    .from(user)
    .where(and(eq(user.id, userId), eq(user.storeId, storeId)));
  if (!target) throw new AppError("NOT_FOUND");
  const updated = await db
    .update(account)
    .set({ password: await hashPassword(password) })
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
    .returning({ id: account.id });
  if (!updated.length) throw new AppError("NOT_FOUND");
  await db.delete(session).where(eq(session.userId, userId));
  await recordAudit(db, actor, {
    action: "store.user_password_reset",
    targetType: "user",
    targetId: userId,
    storeId,
    details: { username: target.username },
  });
  return { ok: true as const };
}
