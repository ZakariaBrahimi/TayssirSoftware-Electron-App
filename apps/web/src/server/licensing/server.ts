import { and, count, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { licenseActivations, licenses } from "../db/schema";
import { AppError } from "../errors";
import { generateLicenseKey, hashSecret, signEntitlement } from "./token";

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
  input: { key: string; deviceId: string; deviceName?: string },
  privateKey = licensePrivateKey(),
  now = Date.now(),
) {
  const [license] = await db
    .select()
    .from(licenses)
    .where(eq(licenses.keyHash, hashSecret(input.key.trim().toUpperCase())));
  if (!license || license.revokedAt) throw new AppError("LICENSE_INVALID");
  if (license.expiresAt && license.expiresAt.getTime() <= now) throw new AppError("LICENSE_EXPIRED");

  const [existing] = await db
    .select()
    .from(licenseActivations)
    .where(and(eq(licenseActivations.licenseId, license.id), eq(licenseActivations.deviceId, input.deviceId)));
  if (existing) {
    await db
      .update(licenseActivations)
      .set({ lastSeenAt: new Date(now), deviceName: input.deviceName ?? existing.deviceName })
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
      lastSeenAt: new Date(now),
    });
  }

  const token = signEntitlement(
    {
      v: 1,
      kind: "license",
      dev: input.deviceId,
      plan: license.plan,
      ref: license.id,
      exp: license.expiresAt?.getTime() ?? null,
      iat: now,
    },
    privateKey,
  );
  return { token, plan: license.plan, expiresAt: license.expiresAt };
}
