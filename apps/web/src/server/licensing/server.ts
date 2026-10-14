import { and, count, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { licenseActivations, licenses } from "../db/schema";
import { AppError } from "../errors";
import { generateLicenseKey, hashSecret, signEntitlement, verifyEntitlement } from "./token";

/* Vendor side (cloud mode): issues licenses and activates devices. */

export function licensePrivateKey() {
  const key = process.env.LICENSE_PRIVATE_KEY;
  if (!key) throw new AppError("NOT_AVAILABLE", "Licensing is not configured on this server");
  return key;
}

export async function createLicense(
  db: Executor,
  input: { plan: string; maxDevices: number; expiresAt: Date | null; customerName?: string },
) {
  const key = generateLicenseKey();
  const [row] = await db
    .insert(licenses)
    .values({
      keyHash: hashSecret(key),
      keyHint: key.slice(-4),
      plan: input.plan,
      maxDevices: input.maxDevices,
      expiresAt: input.expiresAt,
      customerName: input.customerName,
    })
    .returning();
  return { key, license: row };
}

/** Activates a license key on a device and returns a signed token. */
export async function activateLicense(
  db: Executor,
  input: { key: string; deviceId: string; deviceName?: string; appVersion?: string | null },
  privateKey = licensePrivateKey(),
  now = Date.now(),
) {
  const [license] = await db
    .select()
    .from(licenses)
    .where(eq(licenses.keyHash, hashSecret(input.key.trim().toUpperCase())));
  if (!license || license.revokedAt) throw new AppError("LICENSE_INVALID");
  if (license.expiresAt && license.expiresAt.getTime() <= now)
    throw new AppError("LICENSE_EXPIRED");

  const [existing] = await db
    .select()
    .from(licenseActivations)
    .where(
      and(
        eq(licenseActivations.licenseId, license.id),
        eq(licenseActivations.deviceId, input.deviceId),
      ),
    );
  if (existing) {
    await db
      .update(licenseActivations)
      .set({
        lastSeenAt: new Date(now),
        deviceName: input.deviceName ?? existing.deviceName,
        appVersion: input.appVersion ?? existing.appVersion,
      })
      .where(eq(licenseActivations.id, existing.id));
  } else {
    const [{ used }] = await db
      .select({ used: count() })
      .from(licenseActivations)
      .where(eq(licenseActivations.licenseId, license.id));
    if (used >= license.maxDevices) throw new AppError("ACTIVATION_LIMIT");
    await db.insert(licenseActivations).values({
      licenseId: license.id,
      deviceId: input.deviceId,
      deviceName: input.deviceName,
      appVersion: input.appVersion ?? null,
      lastSeenAt: new Date(now),
    });
  }

  const token = licenseToken(license, input.deviceId, privateKey, now);
  return { token, plan: license.plan, expiresAt: license.expiresAt };
}

function licenseToken(
  license: typeof licenses.$inferSelect,
  deviceId: string,
  privateKey: string,
  now: number,
) {
  return signEntitlement(
    {
      v: 1,
      kind: "license",
      dev: deviceId,
      plan: license.plan,
      ref: license.id,
      exp: license.expiresAt?.getTime() ?? null,
      iat: now,
    },
    privateKey,
  );
}

/**
 * Periodic check-in of an activated desktop. Returns a fresh token carrying
 * the license's current plan and end date (so renewals reach the shop), or
 * `revoked` when the license was revoked or the device slot was freed.
 */
export async function refreshLicense(
  db: Executor,
  input: { token: string; appVersion?: string | null },
  privateKey = licensePrivateKey(),
  now = Date.now(),
) {
  // The private key also verifies (its public half is derived from it).
  const payload = verifyEntitlement(input.token, privateKey);
  if (!payload || payload.kind !== "license") throw new AppError("LICENSE_INVALID");
  const [license] = await db.select().from(licenses).where(eq(licenses.id, payload.ref));
  const [activation] = license
    ? await db
        .select()
        .from(licenseActivations)
        .where(
          and(
            eq(licenseActivations.licenseId, license.id),
            eq(licenseActivations.deviceId, payload.dev),
          ),
        )
    : [];
  if (!license || license.revokedAt || !activation) {
    return { status: "revoked" as const, token: null };
  }
  await db
    .update(licenseActivations)
    .set({ lastSeenAt: new Date(now), appVersion: input.appVersion ?? activation.appVersion })
    .where(eq(licenseActivations.id, activation.id));
  return { status: "ok" as const, token: licenseToken(license, payload.dev, privateKey, now) };
}
