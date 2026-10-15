import { and, asc, count, desc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import type { LICENSE_FILTERS } from "@/lib/validators/platform";
import type { Executor } from "../db/client";
import { licenseActivations, licenses, platformPayments } from "../db/schema";
import { AppError } from "../errors";
import { createLicense as issueLicense } from "../licensing/server";
import type { Actor } from "./access";
import { recordAudit } from "./audit";

export type LicenseFilter = (typeof LICENSE_FILTERS)[number];

const DAY = 86_400_000;

function statusSql(now: number) {
  return sql<LicenseFilter>`(case
    when ${licenses.revokedAt} is not null then 'revoked'
    when ${licenses.expiresAt} is not null and ${licenses.expiresAt} <= ${now} then 'expired'
    else 'active' end)`;
}

const usedSql = sql<number>`(select count(*) from ${licenseActivations} a
  where a.license_id = ${sql.raw('"licenses"."id"')})`;
const lastSeenSql = sql<number | null>`(select max(a.last_seen_at) from ${licenseActivations} a
  where a.license_id = ${sql.raw('"licenses"."id"')})`;

export async function listLicenses(
  db: Executor,
  query: { q?: string; status?: LicenseFilter; page: number; pageSize: number },
  now = Date.now(),
) {
  const status = statusSql(now);
  const filters: (SQL | undefined)[] = [];
  if (query.q) {
    const q = query.q.trim();
    const term = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(
      or(
        sql`${licenses.customerName} like ${term} escape '\\'`,
        eq(licenses.keyHint, q.replace(/^.*-/, "").toUpperCase()),
        eq(licenses.id, q),
      ),
    );
  }
  if (query.status) filters.push(sql`${status} = ${query.status}`);
  const where = and(...filters);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: licenses.id,
        keyHint: licenses.keyHint,
        plan: licenses.plan,
        customerName: licenses.customerName,
        maxDevices: licenses.maxDevices,
        expiresAt: licenses.expiresAt,
        revokedAt: licenses.revokedAt,
        createdAt: licenses.createdAt,
        status,
        devicesUsed: usedSql,
        lastSeenAt: lastSeenSql,
      })
      .from(licenses)
      .where(where)
      .orderBy(desc(licenses.createdAt), asc(licenses.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(licenses).where(where),
  ]);
  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function licenseOptions(db: Executor, q: string) {
  const term = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select({
      id: licenses.id,
      keyHint: licenses.keyHint,
      customerName: licenses.customerName,
      plan: licenses.plan,
    })
    .from(licenses)
    .where(
      and(
        isNull(licenses.revokedAt),
        q
          ? or(
              sql`${licenses.customerName} like ${term} escape '\\'`,
              eq(licenses.keyHint, q.toUpperCase()),
            )
          : undefined,
      ),
    )
    .orderBy(desc(licenses.createdAt))
    .limit(20);
}

async function requireLicense(db: Executor, id: string) {
  const [row] = await db.select().from(licenses).where(eq(licenses.id, id));
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

export async function getLicenseDetail(db: Executor, id: string, now = Date.now()) {
  const [license] = await db
    .select({
      id: licenses.id,
      keyHint: licenses.keyHint,
      plan: licenses.plan,
      customerName: licenses.customerName,
      maxDevices: licenses.maxDevices,
      expiresAt: licenses.expiresAt,
      revokedAt: licenses.revokedAt,
      createdAt: licenses.createdAt,
      status: statusSql(now),
    })
    .from(licenses)
    .where(eq(licenses.id, id));
  if (!license) throw new AppError("NOT_FOUND");
  const [activations, payments] = await Promise.all([
    db
      .select({
        id: licenseActivations.id,
        deviceId: licenseActivations.deviceId,
        deviceName: licenseActivations.deviceName,
        appVersion: licenseActivations.appVersion,
        lastSeenAt: licenseActivations.lastSeenAt,
        createdAt: licenseActivations.createdAt,
      })
      .from(licenseActivations)
      .where(eq(licenseActivations.licenseId, id))
      .orderBy(asc(licenseActivations.createdAt)),
    db
      .select()
      .from(platformPayments)
      .where(eq(platformPayments.licenseId, id))
      .orderBy(desc(platformPayments.createdAt)),
  ]);
  return {
    license,
    // Fingerprints are long hashes: a prefix is enough to tell PCs apart.
    activations: activations.map((a) => ({ ...a, deviceId: a.deviceId.slice(0, 12) })),
    payments,
  };
}

export async function createLicense(
  db: Executor,
  actor: Actor,
  input: { plan: string; maxDevices: number; days: number | null; customerName?: string },
  now = Date.now(),
) {
  const result = await issueLicense(db, {
    plan: input.plan,
    maxDevices: input.maxDevices,
    expiresAt: input.days ? new Date(now + input.days * DAY) : null,
    customerName: input.customerName,
  });
  await recordAudit(db, actor, {
    action: "license.create",
    targetType: "license",
    targetId: result.license.id,
    details: {
      hint: result.license.keyHint,
      plan: input.plan,
      maxDevices: input.maxDevices,
      customer: input.customerName ?? null,
      expiresAt: result.license.expiresAt?.getTime() ?? null,
    },
  });
  return result;
}

export async function updateLicense(
  db: Executor,
  actor: Actor,
  id: string,
  input: {
    plan?: string;
    maxDevices?: number;
    customerName?: string | null;
    expiresAt?: Date | null;
  },
) {
  const before = await requireLicense(db, id);
  const [row] = await db.update(licenses).set(input).where(eq(licenses.id, id)).returning();
  await recordAudit(db, actor, {
    action: "license.update",
    targetType: "license",
    targetId: id,
    details: {
      hint: before.keyHint,
      changes: Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, v instanceof Date ? v.getTime() : v]),
      ),
    },
  });
  return row;
}

export async function setLicenseRevoked(db: Executor, actor: Actor, id: string, revoked: boolean) {
  const before = await requireLicense(db, id);
  const [row] = await db
    .update(licenses)
    .set({ revokedAt: revoked ? new Date() : null })
    .where(eq(licenses.id, id))
    .returning();
  await recordAudit(db, actor, {
    action: revoked ? "license.revoke" : "license.restore",
    targetType: "license",
    targetId: id,
    details: { hint: before.keyHint, customer: before.customerName },
  });
  return row;
}

/** Frees device slots: one activation, or all of them. */
export async function removeActivations(
  db: Executor,
  actor: Actor,
  licenseId: string,
  activationId?: string,
) {
  const license = await requireLicense(db, licenseId);
  const removed = await db
    .delete(licenseActivations)
    .where(
      and(
        eq(licenseActivations.licenseId, licenseId),
        activationId ? eq(licenseActivations.id, activationId) : undefined,
      ),
    )
    .returning({ id: licenseActivations.id, deviceName: licenseActivations.deviceName });
  if (activationId && !removed.length) throw new AppError("NOT_FOUND");
  await recordAudit(db, actor, {
    action: activationId ? "license.device_remove" : "license.reset",
    targetType: "license",
    targetId: licenseId,
    details: {
      hint: license.keyHint,
      devices: removed.map((r) => r.deviceName ?? r.id),
    },
  });
  return { removed: removed.length };
}

export async function licenseCounts(db: Executor, now = Date.now()) {
  const [row] = await db
    .select({
      active: sql<number>`coalesce(sum(case when ${statusSql(now)} = 'active' then 1 else 0 end), 0)`,
      total: count(),
    })
    .from(licenses);
  const [{ devices }] = await db
    .select({ devices: count() })
    .from(licenseActivations)
    .innerJoin(licenses, eq(licenses.id, licenseActivations.licenseId))
    .where(isNull(licenses.revokedAt));
  return { active: Number(row.active), total: row.total, devices };
}
