import { hashPassword, verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saleCreateInput } from "@/lib/validators";
import { makeDb, makeStore } from "@/test/helpers";
import type { Database } from "../db/client";
import { account, licenseActivations, licenses, session, stores, user } from "../db/schema";
import { getEntitlement } from "../licensing/entitlements";
import { activateLicense, refreshLicense } from "../licensing/server";
import { generateSigningKeys, verifyEntitlement } from "../licensing/token";
import { createSale } from "../services/sales";
import { isPlatformAdmin, type Actor } from "./access";
import { listAudit } from "./audit";
import { touchStore, resetActivityThrottle } from "./activity";
import { listDevices, revokeDevice } from "./devices";
import {
  createLicense,
  getLicenseDetail,
  listLicenses,
  removeActivations,
  setLicenseRevoked,
} from "./licenses";
import { getOverview } from "./overview";
import { addMonths, listPayments, recordPayment, voidPayment } from "./payments";
import {
  extendTrial,
  getStoreDetail,
  listStores,
  reactivateStore,
  resetStoreUserPassword,
  setSubscription,
  suspendStore,
} from "./stores";
import { syncDevices } from "../db/schema";
import { servePull } from "../sync/cloud";
import { makeProduct } from "@/test/helpers";

const DAY = 86_400_000;
const actor: Actor = { id: "owner-1", name: "owner", ip: "1.2.3.4" };
const keys = generateSigningKeys();

async function addUser(db: Database, storeId: string | null, username: string, role = "admin") {
  const id = crypto.randomUUID();
  await db.insert(user).values({
    id,
    name: username,
    email: `${username}@x.local`,
    username,
    role,
    storeId,
  });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword("old-password"),
  });
  return id;
}

describe("platform access", () => {
  const prev = process.env.PLATFORM_ADMINS;
  afterEach(() => {
    process.env.PLATFORM_ADMINS = prev;
  });

  it("needs the platform role, no store and the PLATFORM_ADMINS list", () => {
    process.env.PLATFORM_ADMINS = "Owner, other";
    expect(isPlatformAdmin({ role: "platform", username: "owner", storeId: null })).toBe(true);
    expect(isPlatformAdmin({ role: "admin", username: "owner", storeId: null })).toBe(false);
    expect(isPlatformAdmin({ role: "platform", username: "owner", storeId: "s1" })).toBe(false);
    expect(isPlatformAdmin({ role: "platform", username: "intruder", storeId: null })).toBe(false);
    process.env.PLATFORM_ADMINS = "";
    expect(isPlatformAdmin({ role: "platform", username: "owner", storeId: null })).toBe(false);
  });
});

describe("platform console services", () => {
  let db: Database;
  const now = Date.UTC(2026, 9, 14, 12);

  const prevMode = process.env.TAYSSIR_MODE;
  beforeEach(async () => {
    db = await makeDb();
    resetActivityThrottle();
    process.env.TAYSSIR_MODE = "cloud";
  });
  afterEach(() => {
    process.env.TAYSSIR_MODE = prevMode;
  });

  it("lists stores with their effective status, owner and filters", async () => {
    const a = await makeStore(db, "Alpha Market");
    const b = await makeStore(db, "Beta Shop");
    const c = await makeStore(db, "Gamma");
    await addUser(db, a.store.id, "alice");
    await db
      .update(stores)
      .set({ trialEndsAt: new Date(now - DAY) })
      .where(eq(stores.id, b.store.id));
    await setSubscription(db, actor, c.store.id, {
      status: "active",
      plan: "pro",
      currentPeriodEnd: new Date(now + 30 * DAY),
    });
    await touchStore(db, a.store.id, now);

    const all = await listStores(db, { sort: "-createdAt", page: 1, pageSize: 20 }, now);
    const byName = Object.fromEntries(all.rows.map((r) => [r.name, r]));
    expect(all.total).toBe(3);
    expect(byName["Alpha Market"].status).toBe("trialing");
    expect(byName["Alpha Market"].owner).toBe("alice");
    expect(byName["Alpha Market"].lastSeenAt).toBe(now);
    expect(byName["Beta Shop"].status).toBe("trial_expired");
    expect(byName["Gamma"].status).toBe("active");

    const expired = await listStores(
      db,
      { status: "trial_expired", sort: "name", page: 1, pageSize: 20 },
      now,
    );
    expect(expired.rows.map((r) => r.name)).toEqual(["Beta Shop"]);
    // Search by store name or by a user's username.
    const byUser = await listStores(db, { q: "ali", sort: "name", page: 1, pageSize: 20 }, now);
    expect(byUser.rows.map((r) => r.name)).toEqual(["Alpha Market"]);
  });

  it("renews a subscription from a payment, stacking on the paid period", async () => {
    const { store } = await makeStore(db);
    const first = await recordPayment(
      db,
      actor,
      { storeId: store.id, amount: 300000, method: "ccp", months: 1, plan: "pro" },
      now,
    );
    expect(first.periodStart?.getTime()).toBe(now);
    expect(first.periodEnd?.getTime()).toBe(addMonths(new Date(now), 1).getTime());
    let [row] = await db.select().from(stores).where(eq(stores.id, store.id));
    expect(row.subscriptionStatus).toBe("active");
    expect(row.plan).toBe("pro");

    // Paid early: the new months start when the current period ends.
    const second = await recordPayment(
      db,
      actor,
      { storeId: store.id, amount: 3000000, method: "bank_transfer", months: 12 },
      now + 5 * DAY,
    );
    expect(second.periodStart?.getTime()).toBe(first.periodEnd?.getTime());
    [row] = await db.select().from(stores).where(eq(stores.id, store.id));
    expect(row.currentPeriodEnd?.getTime()).toBe(second.periodEnd?.getTime());
    expect(second.plan).toBe("pro");

    const ent = await getEntitlement(db, store.id, now + 40 * DAY);
    expect(ent).toMatchObject({ status: "active", source: "subscription", canWrite: true });

    await voidPayment(db, actor, first.id, "duplicate");
    const page = await listPayments(db, { page: 1, pageSize: 20 });
    expect(page.total).toBe(2);
    expect(page.amount).toBe(3000000);
    await expect(voidPayment(db, actor, first.id, "again")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("clamps month ends when adding months", () => {
    expect(
      addMonths(new Date(Date.UTC(2026, 0, 31)), 1)
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-02-28");
    expect(
      addMonths(new Date(Date.UTC(2026, 10, 15)), 3)
        .toISOString()
        .slice(0, 10),
    ).toBe("2027-02-15");
  });

  it("extends trials, suspends (read-only) and reactivates stores", async () => {
    const { store } = await makeStore(db);
    await db
      .update(stores)
      .set({ trialEndsAt: new Date(now - 3 * DAY) })
      .where(eq(stores.id, store.id));
    const extended = await extendTrial(db, actor, store.id, 7, now);
    expect(extended.trialEndsAt?.getTime()).toBe(now + 7 * DAY);

    await suspendStore(db, actor, store.id, "Unpaid");
    expect(await getEntitlement(db, store.id, now)).toMatchObject({
      status: "suspended",
      canWrite: false,
    });
    const detail = await getStoreDetail(db, store.id, now);
    expect(detail.store.status).toBe("suspended");
    expect(detail.store.suspendReason).toBe("Unpaid");

    await reactivateStore(db, actor, store.id);
    expect((await getEntitlement(db, store.id, now)).canWrite).toBe(true);

    const audit = await listAudit(db, { storeId: store.id, page: 1, pageSize: 20 });
    expect(audit.rows.map((r) => r.action)).toEqual([
      "store.reactivate",
      "store.suspend",
      "store.trial_extend",
    ]);
    expect(audit.rows[0]).toMatchObject({ actorName: "owner", ip: "1.2.3.4" });
  });

  it("shows store totals without exposing business records", async () => {
    const { store, ctx } = await makeStore(db);
    const product = await makeProduct(db, ctx, { stock: 5, salePrice: 1000 });
    await createSale(
      db,
      ctx,
      saleCreateInput.parse({
        items: [{ productId: product.id, quantity: 2 }],
        paymentMethod: "cash",
        amountPaid: 2000,
      }),
      { deviceCode: "W" },
    );
    const detail = await getStoreDetail(db, store.id);
    expect(detail.stats).toMatchObject({
      products: 1,
      salesTotal: 1,
      sales30: 1,
      revenue30: 2000,
    });
  });

  it("resets a store user's password and signs them out", async () => {
    const { store } = await makeStore(db);
    const other = await makeStore(db, "Other");
    const uid = await addUser(db, store.id, "bob");
    await db.insert(session).values({
      id: "s1",
      token: "t1",
      userId: uid,
      expiresAt: new Date(Date.now() + DAY),
    });
    const detail = await getStoreDetail(db, store.id);
    // Within a minute of now (auth tables store seconds).
    expect(Math.abs(Number(detail.users[0].lastLoginAt) - Date.now())).toBeLessThan(60_000);
    await expect(
      resetStoreUserPassword(db, actor, other.store.id, uid, "new-password"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await resetStoreUserPassword(db, actor, store.id, uid, "new-password");
    const [acc] = await db.select().from(account).where(eq(account.userId, uid));
    expect(await verifyPassword({ hash: acc.password!, password: "new-password" })).toBe(true);
    expect(await db.select().from(session).where(eq(session.userId, uid))).toHaveLength(0);
  });

  it("manages licenses: list, revoke/restore, free device slots", async () => {
    const { key, license } = await createLicense(db, actor, {
      plan: "pro",
      maxDevices: 2,
      days: 365,
      customerName: "Superette X",
    });
    await activateLicense(db, { key, deviceId: "pc-1", deviceName: "Till 1" }, keys.privateKey);
    await activateLicense(db, { key, deviceId: "pc-2", deviceName: "Till 2" }, keys.privateKey);

    let list = await listLicenses(db, { q: "superette", page: 1, pageSize: 20 });
    expect(list.rows[0]).toMatchObject({ devicesUsed: 2, status: "active", plan: "pro" });
    list = await listLicenses(db, { q: key, page: 1, pageSize: 20 });
    expect(list.total).toBe(1);

    const detail = await getLicenseDetail(db, license.id);
    expect(detail.activations).toHaveLength(2);
    await removeActivations(db, actor, license.id, detail.activations[0].id);
    expect((await getLicenseDetail(db, license.id)).activations).toHaveLength(1);

    await setLicenseRevoked(db, actor, license.id, true);
    expect((await listLicenses(db, { status: "revoked", page: 1, pageSize: 20 })).total).toBe(1);
    await setLicenseRevoked(db, actor, license.id, false);
    await removeActivations(db, actor, license.id);
    expect(
      await db
        .select()
        .from(licenseActivations)
        .where(eq(licenseActivations.licenseId, license.id)),
    ).toHaveLength(0);
  });

  it("license check-in renews tokens and reports revocation", async () => {
    const { key, license } = await createLicense(db, actor, {
      plan: "standard",
      maxDevices: 1,
      days: 30,
    });
    const { token } = await activateLicense(db, { key, deviceId: "pc-1" }, keys.privateKey);

    // A renewal paid on the console reaches the desktop at its next check-in.
    await recordPayment(db, actor, {
      licenseId: license.id,
      amount: 100000,
      method: "cash",
      months: 12,
    });
    const refreshed = await refreshLicense(db, { token, appVersion: "2.1.0" }, keys.privateKey);
    expect(refreshed.status).toBe("ok");
    const payload = verifyEntitlement(refreshed.token!, keys.publicKey)!;
    expect(payload.exp).toBeGreaterThan(Date.now() + 300 * DAY);
    const [act] = await db
      .select()
      .from(licenseActivations)
      .where(eq(licenseActivations.licenseId, license.id));
    expect(act.appVersion).toBe("2.1.0");

    await setLicenseRevoked(db, actor, license.id, true);
    expect(await refreshLicense(db, { token }, keys.privateKey)).toEqual({
      status: "revoked",
      token: null,
    });
    // Tokens signed by someone else are refused.
    const forged = await createLicense(db, actor, { plan: "x", maxDevices: 1, days: null });
    const other = generateSigningKeys();
    const foreign = await activateLicense(
      db,
      { key: forged.key, deviceId: "pc-9" },
      other.privateKey,
    );
    await expect(
      refreshLicense(db, { token: foreign.token }, keys.privateKey),
    ).rejects.toMatchObject({ code: "LICENSE_INVALID" });
    expect((await db.select().from(licenses)).length).toBe(2);
  });

  it("lists and revokes synced devices across stores", async () => {
    const { store } = await makeStore(db, "Shop A");
    await db.insert(syncDevices).values([
      {
        storeId: store.id,
        name: "Till",
        deviceCode: "D1",
        tokenHash: "h1",
        appVersion: "2.1.0",
        lastSeenAt: new Date(),
      },
      {
        storeId: store.id,
        name: "Back office",
        deviceCode: "D2",
        tokenHash: "h2",
        lastSeenAt: new Date(Date.now() - 10 * DAY),
      },
    ]);
    const all = await listDevices(db, { page: 1, pageSize: 20 });
    expect(all.rows.map((d) => [d.name, d.status, d.storeName])).toEqual([
      ["Till", "active", "Shop A"],
      ["Back office", "stale", "Shop A"],
    ]);
    expect(all.versions).toContainEqual({ version: "2.1.0", devices: 1 });
    await revokeDevice(db, actor, all.rows[0].id);
    expect((await listDevices(db, { status: "revoked", page: 1, pageSize: 20 })).total).toBe(1);
  });

  it("tells linked desktops to drop access when a store is suspended", async () => {
    const { store } = await makeStore(db);
    const prevKey = process.env.LICENSE_PRIVATE_KEY;
    process.env.LICENSE_PRIVATE_KEY = keys.privateKey;
    try {
      const active = await servePull(db, store.id, 0, "pc-1");
      expect(verifyEntitlement(active.entitlementToken!, keys.publicKey)?.kind).toBe(
        "subscription",
      );
      await suspendStore(db, actor, store.id, "Fraud");
      expect((await servePull(db, store.id, 0, "pc-1")).entitlementToken).toBe("");
    } finally {
      process.env.LICENSE_PRIVATE_KEY = prevKey;
    }
  });

  it("computes the overview", async () => {
    const a = await makeStore(db, "Paying");
    const b = await makeStore(db, "Trial ending");
    await makeStore(db, "Fresh trial");
    await recordPayment(
      db,
      actor,
      { storeId: a.store.id, amount: 1_200_000, method: "cash", months: 12 },
      now,
    );
    await db
      .update(stores)
      .set({ trialEndsAt: new Date(now + 2 * DAY) })
      .where(eq(stores.id, b.store.id));
    await touchStore(db, a.store.id, now);

    const o = await getOverview(db, now);
    expect(o.stores.total).toBe(3);
    expect(o.stores.paying).toBe(1);
    expect(o.stores.byStatus).toMatchObject({ active: 1, trialing: 2 });
    expect(o.revenue.mrr).toBe(100_000);
    expect(o.attention.trialsEnding.map((s) => s.name)).toContain("Trial ending");
    expect(o.stores.activeLast7Days).toBe(1);
  });
});
