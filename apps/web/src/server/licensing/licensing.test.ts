import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeDb, makeStore } from "@/test/helpers";
import type { Database } from "../db/client";
import { stores } from "../db/schema";
import { setMeta } from "../services/meta";
import { getDeviceId, getEntitlement } from "./entitlements";
import { activateLicense, createLicense } from "./server";
import {
  generateLicenseKey,
  generateSigningKeys,
  signEntitlement,
  verifyEntitlement,
} from "./token";

const keys = generateSigningKeys();
const other = generateSigningKeys();
const DAY = 86_400_000;

describe("entitlement tokens", () => {
  it("verifies genuine tokens and rejects forged or tampered ones", () => {
    const payload = {
      v: 1 as const,
      kind: "license" as const,
      dev: "dev-1",
      plan: "pro",
      ref: "lic",
      exp: null,
      iat: 1,
    };
    const token = signEntitlement(payload, keys.privateKey);
    expect(verifyEntitlement(token, keys.publicKey)).toEqual(payload);
    expect(verifyEntitlement(token, other.publicKey)).toBeNull();
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, plan: "enterprise" })).toString(
      "base64url",
    );
    expect(verifyEntitlement(`${forged}.${sig}`, keys.publicKey)).toBeNull();
    expect(verifyEntitlement(`${body}.`, keys.publicKey)).toBeNull();
    // Base64-encoded PEM (single-line env var) works too.
    expect(verifyEntitlement(token, Buffer.from(keys.publicKey).toString("base64"))).toEqual(
      payload,
    );
  });

  it("generates readable license keys", () => {
    expect(generateLicenseKey()).toMatch(/^TAYS(-[A-HJ-NP-Z2-9]{4}){4}$/);
  });
});

describe("license server", () => {
  let db: Database;
  beforeEach(async () => {
    db = await makeDb();
  });

  it("activates up to the device limit and re-activates the same device", async () => {
    const { key } = await createLicense(db, { plan: "pro", maxDevices: 1, expiresAt: null });
    const first = await activateLicense(db, { key, deviceId: "device-A" }, keys.privateKey);
    expect(verifyEntitlement(first.token, keys.publicKey)?.dev).toBe("device-A");
    await activateLicense(db, { key: key.toLowerCase(), deviceId: "device-A" }, keys.privateKey);
    await expect(
      activateLicense(db, { key, deviceId: "device-B" }, keys.privateKey),
    ).rejects.toMatchObject({
      code: "ACTIVATION_LIMIT",
    });
    await expect(
      activateLicense(db, { key: "TAYS-AAAA-BBBB-CCCC-DDDD", deviceId: "x" }, keys.privateKey),
    ).rejects.toMatchObject({ code: "LICENSE_INVALID" });
  });

  it("refuses expired licenses", async () => {
    const { key } = await createLicense(db, {
      plan: "pro",
      maxDevices: 1,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(
      activateLicense(db, { key, deviceId: "d" }, keys.privateKey),
    ).rejects.toMatchObject({
      code: "LICENSE_EXPIRED",
    });
  });
});

describe("entitlements", () => {
  let db: Database;
  let storeId: string;
  const env = { ...process.env };

  beforeEach(async () => {
    db = await makeDb();
    ({
      store: { id: storeId },
    } = await makeStore(db));
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("is unmanaged when the build has no license key", async () => {
    delete process.env.LICENSE_PUBLIC_KEY;
    delete process.env.TAYSSIR_MODE;
    expect(await getEntitlement(db, storeId)).toMatchObject({
      status: "unmanaged",
      canWrite: true,
    });
  });

  it("runs a 14-day trial, then requires a license bound to this device", async () => {
    process.env.LICENSE_PUBLIC_KEY = keys.publicKey;
    delete process.env.TAYSSIR_MODE;
    const now = Date.now();
    await setMeta(db, "installedAt", String(now));
    expect(await getEntitlement(db, storeId, now)).toMatchObject({
      status: "trial",
      daysLeft: 14,
      canWrite: true,
    });
    expect(await getEntitlement(db, storeId, now + 15 * DAY)).toMatchObject({
      status: "expired",
      canWrite: false,
    });

    const deviceId = await getDeviceId(db);
    const sign = (dev: string, exp: number | null) =>
      signEntitlement(
        { v: 1, kind: "license", dev, plan: "pro", ref: "l", exp, iat: now },
        keys.privateKey,
      );

    await setMeta(db, "licenseToken", sign("another-pc", null));
    expect((await getEntitlement(db, storeId, now + 15 * DAY)).canWrite).toBe(false);

    await setMeta(db, "licenseToken", sign(deviceId, null));
    expect(await getEntitlement(db, storeId, now + 15 * DAY)).toMatchObject({
      status: "active",
      source: "license",
      plan: "pro",
      canWrite: true,
    });

    await setMeta(db, "licenseToken", sign(deviceId, now + 20 * DAY));
    expect((await getEntitlement(db, storeId, now + 21 * DAY)).canWrite).toBe(false);
  });

  it("follows the subscription in cloud mode", async () => {
    process.env.TAYSSIR_MODE = "cloud";
    const now = Date.now();
    expect(await getEntitlement(db, storeId, now)).toMatchObject({
      status: "trial",
      canWrite: true,
    });
    expect((await getEntitlement(db, storeId, now + 15 * DAY)).canWrite).toBe(false);

    await db
      .update(stores)
      .set({
        subscriptionStatus: "active",
        plan: "pro",
        currentPeriodEnd: new Date(now + 30 * DAY),
      })
      .where(eq(stores.id, storeId));
    expect(await getEntitlement(db, storeId, now + 15 * DAY)).toMatchObject({
      status: "active",
      plan: "pro",
    });
    expect((await getEntitlement(db, storeId, now + 31 * DAY)).canWrite).toBe(false);

    await db.update(stores).set({ subscriptionStatus: "canceled" }).where(eq(stores.id, storeId));
    expect((await getEntitlement(db, storeId, now)).canWrite).toBe(false);
  });
});
