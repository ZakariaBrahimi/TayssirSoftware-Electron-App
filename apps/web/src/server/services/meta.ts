import { eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { appMeta } from "../db/schema";

/** Settings of this installation that are never synced (see `app_meta`). */
export type MetaKey =
  | "installedAt"
  | "deviceId"
  | "deviceCode"
  | "licenseToken"
  | "lastBackupAt"
  | "sync.cloudUrl"
  | "sync.deviceToken"
  | "sync.deviceName"
  | "sync.pushCursor"
  | "sync.pullCursor"
  | "sync.lastSyncAt"
  | "sync.lastError"
  | "sync.entitlementToken"
  | "platform.settings";

export async function getMeta(db: Executor, key: MetaKey): Promise<string | null> {
  const [row] = await db.select().from(appMeta).where(eq(appMeta.key, key));
  return row?.value ?? null;
}

export async function setMeta(db: Executor, key: MetaKey, value: string | null) {
  if (value === null) {
    await db.delete(appMeta).where(eq(appMeta.key, key));
    return;
  }
  await db
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } });
}

export async function getOrInitMeta(db: Executor, key: MetaKey, init: () => string) {
  const existing = await getMeta(db, key);
  if (existing) return existing;
  const value = init();
  await db.insert(appMeta).values({ key, value }).onConflictDoNothing();
  return (await getMeta(db, key)) ?? value;
}

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Short code identifying this install in receipt numbers (e.g. "KQM-42"). */
export function getDeviceCode(db: Executor) {
  return getOrInitMeta(db, "deviceCode", () =>
    Array.from({ length: 3 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(""),
  );
}
