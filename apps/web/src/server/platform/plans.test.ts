import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeDb, makeStore } from "@/test/helpers";
import type { Database } from "../db/client";
import { licenses, stores } from "../db/schema";
import { getEntitlement, hasFeature } from "../licensing/entitlements";
import { activateLicense } from "../licensing/server";
import { generateSigningKeys, verifyEntitlement } from "../licensing/token";
import type { Actor } from "./access";
import {
  approveRequest,
  createRequest,
  listOwnRequests,
  publicCatalog,
  rejectRequest,
} from "./billing";
import { createLicense } from "./licenses";
import { addMonths, recordPayment } from "./payments";
import { getPlan, listPlans, updatePlan } from "./plans";

const DAY = 86_400_000;
const actor: Actor = { id: "owner", name: "owner" };
const keys = generateSigningKeys();

/** Essentiel 2 000 DA/month, Pro 4 000 DA/month (as set in the console). */
async function setPrices(db: Database) {
  const [ess, pro] = await Promise.all([getPlan(db, "essentiel"), getPlan(db, "pro")]);
  await updatePlan(db, actor, "essentiel", {
    ...ess!,
    monthlyPrice: 2000,
    yearlyPrice: 20000,
    licensePrice: 15000,
  });
  await updatePlan(db, actor, "pro", {
    ...pro!,
    monthlyPrice: 4000,
    yearlyPrice: 40000,
    licensePrice: 30000,
  });
}

describe("subscription plans", () => {
  let db: Database;
  const prevMode = process.env.TAYSSIR_MODE;
  const now = Date.UTC(2026, 9, 14, 12);

  beforeEach(async () => {
    db = await makeDb();
    process.env.TAYSSIR_MODE = "cloud";
  });
  afterEach(() => {
    process.env.TAYSSIR_MODE = prevMode;
  });

  it("ships with Essentiel and Pro, limits included", async () => {
    const plans = await listPlans(db);
    expect(plans.map((p) => [p.code, p.maxDevices, p.maxUsers, p.features])).toEqual([
      ["essentiel", 1, 2, []],
      ["pro", 3, null, ["suppliers", "shifts", "import"]],
    ]);
    const catalog = await publicCatalog(db);
    expect(catalog.plans[1]).toMatchObject({ code: "pro", recommended: true, monthlyPrice: null });
  });

  it("applies plan limits to a store, but not during the trial", async () => {
    const { store } = await makeStore(db);
    let ent = await getEntitlement(db, store.id, now);
    expect(ent.limits).toBeNull();
    expect(hasFeature(ent, "suppliers")).toBe(true);

    await setPrices(db);
    await recordPayment(
      db,
      actor,
      { storeId: store.id, amount: 200000, method: "cash", months: 1, plan: "essentiel" },
      now,
    );
    ent = await getEntitlement(db, store.id, now);
    expect(ent).toMatchObject({ status: "active", plan: "essentiel" });
    expect(ent.limits).toEqual({ maxDevices: 1, maxUsers: 2, features: [] });
    expect(hasFeature(ent, "suppliers")).toBe(false);
  });

  it("upgrades at once, turning unused days into days of the new plan", async () => {
    await setPrices(db);
    const { store } = await makeStore(db);
    await recordPayment(
      db,
      actor,
      { storeId: store.id, amount: 200000, method: "cash", months: 1, plan: "essentiel" },
      now,
    );
    const paidUntil = addMonths(new Date(now), 1).getTime();
    // Ten days later, upgrade to Pro for one month.
    const later = now + 10 * DAY;
    const pay = await recordPayment(
      db,
      actor,
      { storeId: store.id, amount: 400000, method: "ccp", months: 1, plan: "pro" },
      later,
    );
    const unused = paidUntil - later; // about 21 days of Essentiel
    const credit = Math.round((unused * 2000) / 4000); // worth about 10.5 days of Pro
    expect(pay.periodEnd?.getTime()).toBe(addMonths(new Date(later), 1).getTime() + credit);
    const [row] = await db.select().from(stores).where(eq(stores.id, store.id));
    expect(row.plan).toBe("pro");
    expect((await getEntitlement(db, store.id, later)).limits?.features).toContain("shifts");
  });

  it("schedules a downgrade for the end of the paid period", async () => {
    await setPrices(db);
    const { store } = await makeStore(db);
    await recordPayment(
      db,
      actor,
      { storeId: store.id, amount: 400000, method: "cash", months: 1, plan: "pro" },
      now,
    );
    const paidUntil = addMonths(new Date(now), 1);
    const pay = await recordPayment(
      db,
      actor,
      { storeId: store.id, amount: 200000, method: "cash", months: 1, plan: "essentiel" },
      now + DAY,
    );
    expect(pay.periodStart?.getTime()).toBe(paidUntil.getTime());

    let ent = await getEntitlement(db, store.id, now + 2 * DAY);
    expect(ent).toMatchObject({
      plan: "pro",
      scheduledPlan: "essentiel",
      planChangesAt: paidUntil.getTime(),
    });
    ent = await getEntitlement(db, store.id, paidUntil.getTime() + 1000);
    expect(ent).toMatchObject({ plan: "essentiel", scheduledPlan: null });
    expect(ent.limits?.maxDevices).toBe(1);
  });

  it("puts the plan's limits in license tokens", async () => {
    const { key } = await createLicense(db, actor, { plan: "pro", maxDevices: 2, days: null });
    const { token } = await activateLicense(db, { key, deviceId: "pc-1" }, keys.privateKey);
    expect(verifyEntitlement(token, keys.publicKey)?.lim).toEqual({
      d: 2,
      u: null,
      f: ["suppliers", "shifts", "import"],
    });
    // Licenses on plans that aren't in the catalog carry no limits.
    const legacy = await createLicense(db, actor, { plan: "standard", maxDevices: 1, days: null });
    const old = await activateLicense(db, { key: legacy.key, deviceId: "pc-2" }, keys.privateKey);
    expect(verifyEntitlement(old.token, keys.publicKey)?.lim).toBeUndefined();
  });

  it("runs a store's payment request from asking to approval", async () => {
    const { store } = await makeStore(db);
    const me = { type: "store" as const, storeId: store.id };
    const ask = {
      planCode: "pro",
      period: "year" as const,
      method: "ccp" as const,
      reference: "CCP-889",
    };
    await expect(createRequest(db, me, ask)).rejects.toMatchObject({ code: "PRICE_NOT_SET" });
    await setPrices(db);
    await expect(createRequest(db, me, { ...ask, period: "lifetime" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    const req = await createRequest(db, me, ask);
    expect(req).toMatchObject({ status: "pending", amount: 4000000, currency: "DZD" });
    await expect(createRequest(db, me, ask)).rejects.toMatchObject({ code: "REQUEST_PENDING" });

    await approveRequest(db, actor, req.id, now);
    const [row] = await db.select().from(stores).where(eq(stores.id, store.id));
    expect(row).toMatchObject({ plan: "pro", subscriptionStatus: "active" });
    expect(row.currentPeriodEnd?.getTime()).toBe(addMonths(new Date(now), 12).getTime());
    expect((await listOwnRequests(db, me)).requests[0].status).toBe("approved");
    await expect(approveRequest(db, actor, req.id)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("upgrades a license in place and sells new licenses to unlicensed PCs", async () => {
    await setPrices(db);
    const { license } = await createLicense(db, actor, {
      plan: "essentiel",
      maxDevices: 1,
      days: 365,
    });
    const lic = { type: "license" as const, licenseId: license.id, deviceId: "pc-1" };
    await expect(
      createRequest(db, lic, { planCode: "pro", period: "month", method: "cash" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const up = await createRequest(db, lic, {
      planCode: "pro",
      period: "lifetime",
      method: "cash",
    });
    expect(up.amount).toBe(3000000);
    await approveRequest(db, actor, up.id);
    const [row] = await db.select().from(licenses).where(eq(licenses.id, license.id));
    expect(row).toMatchObject({ plan: "pro", maxDevices: 3, expiresAt: null });
    // A lifetime Pro license cannot buy Pro again.
    await expect(
      createRequest(db, lic, { planCode: "pro", period: "lifetime", method: "cash" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const pc = { type: "device" as const, deviceId: "new-pc-123" };
    const buy = await createRequest(db, pc, {
      planCode: "essentiel",
      period: "lifetime",
      method: "bank_transfer",
      shopName: "Boulangerie Atlas",
      contactPhone: "0555 00 00 00",
    });
    const rejected = await rejectRequest(db, actor, buy.id, "Transfer not received");
    expect(rejected).toMatchObject({ status: "rejected", rejectReason: "Transfer not received" });
    const again = await createRequest(db, pc, {
      planCode: "essentiel",
      period: "lifetime",
      method: "cash",
    });
    const { licenseKey } = await approveRequest(db, actor, again.id);
    expect(licenseKey).toMatch(/^MIZN-/);
    // The PC gets its key once.
    expect((await listOwnRequests(db, pc)).licenseKey).toBe(licenseKey);
    expect((await listOwnRequests(db, pc)).licenseKey).toBeNull();
  });
});
