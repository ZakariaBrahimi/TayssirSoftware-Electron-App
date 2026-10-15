import { and, count, desc, eq, isNull, type SQL } from "drizzle-orm";
import { toMinor } from "@/lib/money";
import {
  type BillingPeriod,
  type PaymentRequestInput,
  paymentRequestInput,
  type RequestStatus,
} from "@/lib/validators/platform";
import type { Executor } from "../db/client";
import { licenses, paymentRequests, platformPayments, stores } from "../db/schema";
import { AppError } from "../errors";
import { type Actor, platformCurrency } from "./access";
import { recordAudit } from "./audit";
import { createLicense } from "./licenses";
import { recordPayment } from "./payments";
import { getPlan, listPlans, type Plan } from "./plans";
import { getPlatformSettings } from "./settings";

/*
 * Self-service billing: a shop picks a plan, pays by CCP / BaridiMob /
 * transfer, and sends a request; the platform owner approves it, which
 * records the payment and applies the plan.
 */

/** Who is asking to pay. */
export type Requester =
  | { type: "store"; storeId: string }
  | { type: "license"; licenseId: string; deviceId: string }
  /** A PC without a license yet: approval creates one for it. */
  | { type: "device"; deviceId: string };

/** Public view of a plan (landing page, subscription page, desktops). */
export const publicPlan = (p: Plan) => ({
  code: p.code,
  name: { en: p.nameEn, fr: p.nameFr, ar: p.nameAr },
  description: { en: p.descEn, fr: p.descFr, ar: p.descAr },
  monthlyPrice: p.monthlyPrice,
  yearlyPrice: p.yearlyPrice,
  licensePrice: p.licensePrice,
  maxDevices: p.maxDevices,
  maxUsers: p.maxUsers,
  features: p.features,
  recommended: p.recommended,
});
export type PublicPlan = ReturnType<typeof publicPlan>;

/** Everything a shop needs to choose and pay for a plan. */
export async function publicCatalog(db: Executor) {
  const [plans, settings] = await Promise.all([
    listPlans(db, { activeOnly: true }),
    getPlatformSettings(db),
  ]);
  return {
    currency: platformCurrency(),
    trialDays: settings.trialDays,
    plans: plans.map(publicPlan),
    payment: {
      payeeName: settings.payeeName,
      ccpAccount: settings.ccpAccount,
      ripAccount: settings.ripAccount,
      bankRib: settings.bankRib,
      note: settings.paymentNote,
    },
    contact: {
      phone: settings.contactPhone,
      whatsapp: settings.contactWhatsapp,
      email: settings.contactEmail,
    },
  };
}
export type PublicCatalog = Awaited<ReturnType<typeof publicCatalog>>;

/** What a period costs and buys. Prices are whole dinars in the catalog. */
export function quote(plan: Plan, period: BillingPeriod) {
  const price =
    period === "month"
      ? plan.monthlyPrice
      : period === "year"
        ? plan.yearlyPrice
        : plan.licensePrice;
  if (price === null) throw new AppError("PRICE_NOT_SET");
  const currency = platformCurrency();
  return {
    amount: toMinor(price, currency),
    currency,
    months: period === "month" ? 1 : period === "year" ? 12 : 0,
  };
}

function ownerFilter(r: Requester): SQL {
  if (r.type === "store") return eq(paymentRequests.storeId, r.storeId);
  if (r.type === "license") return eq(paymentRequests.licenseId, r.licenseId);
  return and(
    eq(paymentRequests.deviceId, r.deviceId),
    isNull(paymentRequests.licenseId),
    isNull(paymentRequests.storeId),
  )!;
}

const ownerValues = (r: Requester) =>
  r.type === "store"
    ? { storeId: r.storeId }
    : r.type === "license"
      ? { licenseId: r.licenseId, deviceId: r.deviceId }
      : { deviceId: r.deviceId };

export async function createRequest(
  db: Executor,
  requester: Requester,
  input: PaymentRequestInput,
) {
  const data = paymentRequestInput.parse(input);
  const plan = await getPlan(db, data.planCode);
  if (!plan || !plan.active) throw new AppError("NOT_FOUND");
  // Online stores subscribe; PCs that work on their own buy a license.
  const allowed: BillingPeriod[] = requester.type === "store" ? ["month", "year"] : ["lifetime"];
  if (!allowed.includes(data.period)) throw new AppError("VALIDATION_ERROR", "period");
  const price = quote(plan, data.period);
  if (requester.type === "license") {
    // Buying the plan a PC already owns for good would only charge it twice.
    const [owned] = await db
      .select({ plan: licenses.plan, expiresAt: licenses.expiresAt, revokedAt: licenses.revokedAt })
      .from(licenses)
      .where(eq(licenses.id, requester.licenseId));
    if (owned && !owned.revokedAt && !owned.expiresAt && owned.plan === plan.code) {
      throw new AppError("VALIDATION_ERROR", "already_owned");
    }
  }

  const [pending] = await db
    .select({ id: paymentRequests.id })
    .from(paymentRequests)
    .where(and(ownerFilter(requester), eq(paymentRequests.status, "pending")));
  if (pending) throw new AppError("REQUEST_PENDING");

  const [row] = await db
    .insert(paymentRequests)
    .values({
      ...ownerValues(requester),
      planCode: plan.code,
      period: data.period,
      months: price.months,
      amount: price.amount,
      currency: price.currency,
      method: data.method,
      reference: data.reference,
      note: data.note,
      receipt: data.receipt,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      shopName: data.shopName,
    })
    .returning();
  return ownView(row);
}

/** A request as its sender sees it (no receipt image, no internal fields). */
function ownView(row: typeof paymentRequests.$inferSelect) {
  return {
    id: row.id,
    planCode: row.planCode,
    period: row.period,
    amount: row.amount,
    currency: row.currency,
    method: row.method,
    reference: row.reference,
    status: row.status,
    rejectReason: row.rejectReason,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
  };
}

/**
 * The sender's latest requests. A license key created for an unlicensed
 * PC is handed over once, then forgotten.
 */
export async function listOwnRequests(db: Executor, requester: Requester) {
  const rows = await db
    .select()
    .from(paymentRequests)
    .where(ownerFilter(requester))
    .orderBy(desc(paymentRequests.createdAt))
    .limit(20);
  let licenseKey: string | null = null;
  for (const row of rows) {
    if (row.deliveryKey) {
      licenseKey = row.deliveryKey;
      await db
        .update(paymentRequests)
        .set({ deliveryKey: null })
        .where(eq(paymentRequests.id, row.id));
    }
  }
  return { requests: rows.map(ownView), licenseKey };
}

export async function cancelOwnRequest(db: Executor, requester: Requester, id: string) {
  const [row] = await db
    .update(paymentRequests)
    .set({ status: "canceled", decidedAt: new Date() })
    .where(
      and(
        eq(paymentRequests.id, id),
        ownerFilter(requester),
        eq(paymentRequests.status, "pending"),
      ),
    )
    .returning();
  if (!row) throw new AppError("NOT_FOUND");
  return ownView(row);
}

/* ------------------------------ Console side ------------------------------ */

export async function pendingRequestCount(db: Executor) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(paymentRequests)
    .where(eq(paymentRequests.status, "pending"));
  return n;
}

export async function listRequests(
  db: Executor,
  query: { status?: RequestStatus; page: number; pageSize: number },
) {
  const where = query.status ? eq(paymentRequests.status, query.status) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: paymentRequests.id,
        storeId: paymentRequests.storeId,
        storeName: stores.name,
        licenseId: paymentRequests.licenseId,
        licenseHint: licenses.keyHint,
        licenseCustomer: licenses.customerName,
        deviceId: paymentRequests.deviceId,
        shopName: paymentRequests.shopName,
        contactName: paymentRequests.contactName,
        contactPhone: paymentRequests.contactPhone,
        planCode: paymentRequests.planCode,
        period: paymentRequests.period,
        amount: paymentRequests.amount,
        currency: paymentRequests.currency,
        method: paymentRequests.method,
        reference: paymentRequests.reference,
        status: paymentRequests.status,
        createdAt: paymentRequests.createdAt,
        decidedAt: paymentRequests.decidedAt,
        decidedByName: paymentRequests.decidedByName,
      })
      .from(paymentRequests)
      .leftJoin(stores, eq(stores.id, paymentRequests.storeId))
      .leftJoin(licenses, eq(licenses.id, paymentRequests.licenseId))
      .where(where)
      .orderBy(desc(paymentRequests.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(paymentRequests).where(where),
  ]);
  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getRequest(db: Executor, id: string) {
  const [row] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, id));
  if (!row) throw new AppError("NOT_FOUND");
  const [store, license, plan] = await Promise.all([
    row.storeId
      ? db
          .select({ name: stores.name, plan: stores.plan })
          .from(stores)
          .where(eq(stores.id, row.storeId))
          .then((r) => r[0] ?? null)
      : null,
    row.licenseId
      ? db
          .select({ hint: licenses.keyHint, customer: licenses.customerName, plan: licenses.plan })
          .from(licenses)
          .where(eq(licenses.id, row.licenseId))
          .then((r) => r[0] ?? null)
      : null,
    getPlan(db, row.planCode),
  ]);
  const { deliveryKey, ...rest } = row;
  void deliveryKey;
  return { ...rest, store, license, plan };
}

async function requirePending(db: Executor, id: string) {
  const [row] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, id));
  if (!row) throw new AppError("NOT_FOUND");
  if (row.status !== "pending") throw new AppError("VALIDATION_ERROR", "Not pending");
  return row;
}

/**
 * Approves a request: records the payment and applies the plan. A PC
 * without a license gets a new one; its key is returned here (to show
 * once) and delivered to that PC at its next visit.
 */
export async function approveRequest(db: Executor, actor: Actor, id: string, now = Date.now()) {
  const req = await requirePending(db, id);
  const plan = await getPlan(db, req.planCode);
  if (!plan) throw new AppError("NOT_FOUND");
  const base = {
    amount: req.amount,
    method: req.method,
    reference: req.reference || undefined,
    plan: plan.code,
    note: req.note || undefined,
  };

  let paymentId: string;
  let licenseKey: string | null = null;
  if (req.storeId) {
    paymentId = (
      await recordPayment(db, actor, { ...base, storeId: req.storeId, months: req.months }, now)
    ).id;
  } else if (req.licenseId) {
    paymentId = (
      await recordPayment(
        db,
        actor,
        { ...base, licenseId: req.licenseId, months: 0, lifetime: true },
        now,
      )
    ).id;
  } else {
    const { key, license } = await createLicense(db, actor, {
      plan: plan.code,
      maxDevices: plan.maxDevices ?? 1,
      days: null,
      customerName: req.shopName || req.contactName || undefined,
    });
    licenseKey = key;
    paymentId = (
      await recordPayment(
        db,
        actor,
        { ...base, licenseId: license.id, months: 0, lifetime: true },
        now,
      )
    ).id;
  }

  const [row] = await db
    .update(paymentRequests)
    .set({
      status: "approved",
      decidedAt: new Date(now),
      decidedByName: actor.name,
      paymentId,
      deliveryKey: licenseKey,
    })
    .where(eq(paymentRequests.id, id))
    .returning();
  await recordAudit(db, actor, {
    action: "request.approve",
    targetType: "request",
    targetId: id,
    storeId: req.storeId,
    details: {
      plan: plan.code,
      period: req.period,
      amount: req.amount,
      newLicense: Boolean(licenseKey),
    },
  });
  return { request: ownView(row), licenseKey };
}

export async function rejectRequest(db: Executor, actor: Actor, id: string, reason: string) {
  const req = await requirePending(db, id);
  const [row] = await db
    .update(paymentRequests)
    .set({
      status: "rejected",
      decidedAt: new Date(),
      decidedByName: actor.name,
      rejectReason: reason,
    })
    .where(eq(paymentRequests.id, id))
    .returning();
  await recordAudit(db, actor, {
    action: "request.reject",
    targetType: "request",
    targetId: id,
    storeId: req.storeId,
    details: { plan: req.planCode, reason },
  });
  return ownView(row);
}

/** Payments recorded for a store (its subscription page). */
export async function storePayments(db: Executor, storeId: string) {
  return db
    .select({
      id: platformPayments.id,
      amount: platformPayments.amount,
      currency: platformPayments.currency,
      method: platformPayments.method,
      plan: platformPayments.plan,
      months: platformPayments.months,
      periodEnd: platformPayments.periodEnd,
      createdAt: platformPayments.createdAt,
    })
    .from(platformPayments)
    .where(and(eq(platformPayments.storeId, storeId), isNull(platformPayments.voidedAt)))
    .orderBy(desc(platformPayments.createdAt))
    .limit(24);
}
