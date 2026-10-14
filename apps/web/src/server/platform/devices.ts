import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import type { DEVICE_FILTERS } from "@/lib/validators/platform";
import type { Executor } from "../db/client";
import { stores, syncDevices } from "../db/schema";
import { AppError } from "../errors";
import type { Actor } from "./access";
import { recordAudit } from "./audit";

export type DeviceFilter = (typeof DEVICE_FILTERS)[number];

/** A device that has not synced for this long is shown as stale. */
export const STALE_AFTER_MS = 3 * 86_400_000;

function statusSql(now: number) {
  return sql<DeviceFilter>`(case
    when ${syncDevices.revokedAt} is not null then 'revoked'
    when ${syncDevices.lastSeenAt} is null or ${syncDevices.lastSeenAt} < ${now - STALE_AFTER_MS}
      then 'stale'
    else 'active' end)`;
}

export async function listDevices(
  db: Executor,
  query: { q?: string; status?: DeviceFilter; page: number; pageSize: number },
  now = Date.now(),
) {
  const status = statusSql(now);
  const filters: (SQL | undefined)[] = [];
  if (query.q) {
    const term = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(
      sql`(${syncDevices.name} like ${term} escape '\\' or ${stores.name} like ${term} escape '\\'
        or ${syncDevices.appVersion} = ${query.q})`,
    );
  }
  if (query.status) filters.push(sql`${status} = ${query.status}`);
  const where = and(...filters);
  const [rows, [{ total }], versions] = await Promise.all([
    db
      .select({
        id: syncDevices.id,
        name: syncDevices.name,
        deviceCode: syncDevices.deviceCode,
        appVersion: syncDevices.appVersion,
        lastSeenAt: syncDevices.lastSeenAt,
        revokedAt: syncDevices.revokedAt,
        createdAt: syncDevices.createdAt,
        status,
        storeId: syncDevices.storeId,
        storeName: stores.name,
      })
      .from(syncDevices)
      .leftJoin(stores, eq(stores.id, syncDevices.storeId))
      .where(where)
      .orderBy(sql`${syncDevices.lastSeenAt} desc nulls last`, desc(syncDevices.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ total: count() })
      .from(syncDevices)
      .leftJoin(stores, eq(stores.id, syncDevices.storeId))
      .where(where),
    deviceVersions(db),
  ]);
  return {
    rows,
    total,
    versions,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/** How many active devices run each app version. */
export async function deviceVersions(db: Executor) {
  const rows = await db
    .select({ version: syncDevices.appVersion, devices: count() })
    .from(syncDevices)
    .where(sql`${syncDevices.revokedAt} is null`)
    .groupBy(syncDevices.appVersion)
    .orderBy(desc(count()));
  return rows.map((r) => ({ version: r.version ?? null, devices: r.devices }));
}

export async function revokeDevice(db: Executor, actor: Actor, id: string) {
  const [row] = await db
    .update(syncDevices)
    .set({ revokedAt: new Date() })
    .where(and(eq(syncDevices.id, id), sql`${syncDevices.revokedAt} is null`))
    .returning();
  if (!row) throw new AppError("NOT_FOUND");
  await recordAudit(db, actor, {
    action: "device.revoke",
    targetType: "device",
    targetId: id,
    storeId: row.storeId,
    details: { name: row.name, code: row.deviceCode },
  });
  return row;
}
