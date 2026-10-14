import { and, eq, isNull } from "drizzle-orm";
import type { Database, Executor } from "../db/client";
import { syncDevices } from "../db/schema";
import { AppError } from "../errors";
import { signEntitlement, hashSecret } from "../licensing/token";
import { getEntitlement } from "../licensing/entitlements";
import { getStore, publicStore } from "../services/stores";
import { applyChanges, collectChanges } from "./engine";

/* Cloud side of the sync: links devices, receives pushes, serves pulls. */

const randomToken = () =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");

export async function linkDevice(
  db: Executor,
  input: { username: string; password: string; deviceName: string; deviceId: string },
) {
  // Lazy: the auth module opens the app database (kept out of unit tests).
  const { verifyCredentials } = await import("../services/users");
  const account = await verifyCredentials(db, input.username, input.password);
  if (!account || !account.storeId) throw new AppError("UNAUTHORIZED");
  if (account.role !== "admin") throw new AppError("FORBIDDEN");

  const existing = await db
    .select({ code: syncDevices.deviceCode })
    .from(syncDevices)
    .where(eq(syncDevices.storeId, account.storeId));
  const used = new Set(existing.map((d) => d.code));
  let n = existing.length + 1;
  while (used.has(`D${n}`)) n++;

  const token = randomToken();
  const [device] = await db
    .insert(syncDevices)
    .values({
      storeId: account.storeId,
      name: input.deviceName,
      deviceCode: `D${n}`,
      tokenHash: hashSecret(token),
      lastSeenAt: new Date(),
    })
    .returning();

  const store = await getStore(db, account.storeId);
  return {
    deviceToken: token,
    deviceCode: device.deviceCode,
    store: publicStore(store),
    entitlementToken: await deviceEntitlementToken(db, account.storeId, input.deviceId),
  };
}

export async function authenticateDevice(db: Executor, token: string | undefined) {
  if (!token) throw new AppError("UNAUTHORIZED");
  const [device] = await db
    .select()
    .from(syncDevices)
    .where(and(eq(syncDevices.tokenHash, hashSecret(token)), isNull(syncDevices.revokedAt)));
  if (!device) throw new AppError("UNAUTHORIZED");
  await db.update(syncDevices).set({ lastSeenAt: new Date() }).where(eq(syncDevices.id, device.id));
  return device;
}

/**
 * Signed token letting a linked desktop run on the cloud store's
 * subscription (verified offline by the desktop like a license).
 */
async function deviceEntitlementToken(db: Executor, storeId: string, deviceId: string) {
  const key = process.env.LICENSE_PRIVATE_KEY;
  if (!key || !deviceId) return null;
  const ent = await getEntitlement(db, storeId);
  if (!ent.canWrite || ent.status === "unmanaged") return null;
  // Short-lived when open-ended, so a cancelled subscription stops working.
  const maxExp = Date.now() + 30 * 86_400_000;
  return signEntitlement(
    {
      v: 1,
      kind: "subscription",
      dev: deviceId,
      plan: ent.plan ?? "trial",
      ref: storeId,
      exp: ent.expiresAt === null ? maxExp : Math.min(ent.expiresAt, maxExp),
      iat: Date.now(),
    },
    key,
  );
}

export async function receivePush(
  db: Database,
  storeId: string,
  changes: { tbl: string; row: unknown }[],
) {
  if (changes.length > 1000) throw new AppError("VALIDATION_ERROR", "Too many changes in one push");
  return applyChanges(db, storeId, changes, { suppressLog: false });
}

export async function servePull(db: Executor, storeId: string, cursor: number, deviceId: string) {
  const batch = await collectChanges(db, { since: cursor, storeId, limit: 500 });
  return { ...batch, entitlementToken: await deviceEntitlementToken(db, storeId, deviceId) };
}

export async function listDevices(db: Executor, storeId: string) {
  return db
    .select({
      id: syncDevices.id,
      name: syncDevices.name,
      deviceCode: syncDevices.deviceCode,
      lastSeenAt: syncDevices.lastSeenAt,
      revokedAt: syncDevices.revokedAt,
      createdAt: syncDevices.createdAt,
    })
    .from(syncDevices)
    .where(eq(syncDevices.storeId, storeId));
}

export async function revokeDevice(db: Executor, storeId: string, id: string) {
  const [row] = await db
    .update(syncDevices)
    .set({ revokedAt: new Date() })
    .where(and(eq(syncDevices.id, id), eq(syncDevices.storeId, storeId)))
    .returning({ id: syncDevices.id });
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}
