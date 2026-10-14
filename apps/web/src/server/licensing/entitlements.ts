import { eq } from "drizzle-orm";
import { PLAN_FEATURES, type PlanFeature } from "@/lib/validators/platform";
import { getMode } from "../context";
import type { Executor } from "../db/client";
import { stores } from "../db/schema";
import { limitsForPlan, type PlanLimits } from "../platform/plans";
import { getMeta, getOrInitMeta } from "../services/meta";
import { getStore, TRIAL_DAYS } from "../services/stores";
import { type EntitlementPayload, verifyEntitlement } from "./token";

export type Entitlement = {
  /** "unmanaged": licensing is not enforced by this build. */
  status: "active" | "trial" | "expired" | "suspended" | "unmanaged";
  source: "license" | "subscription" | "trial" | "none";
  plan: string | null;
  expiresAt: number | null;
  daysLeft: number | null;
  /** False when the store may only read data (expired license/subscription). */
  canWrite: boolean;
  /** What the plan allows; null = no limits (trial, unmanaged, older licenses). */
  limits: PlanLimits | null;
  /** A downgrade already paid for, taking effect at `planChangesAt` (cloud). */
  scheduledPlan?: string | null;
  planChangesAt?: number | null;
};

/** Limits carried in a signed token. */
export function limitsFromToken(payload: EntitlementPayload): PlanLimits | null {
  if (!payload.lim) return null;
  return {
    maxDevices: payload.lim.d,
    maxUsers: payload.lim.u,
    features: payload.lim.f.filter((f): f is PlanFeature =>
      PLAN_FEATURES.includes(f as PlanFeature),
    ),
  };
}

/** Limits written into a signed token. */
export function limitsToToken(limits: PlanLimits | null) {
  return limits ? { d: limits.maxDevices, u: limits.maxUsers, f: limits.features } : undefined;
}

/** True when the plan includes the feature (or has no limits). */
export const hasFeature = (ent: Entitlement, feature: PlanFeature) =>
  !ent.limits || ent.limits.features.includes(feature);

const DAY = 86_400_000;

function fromExpiry(
  status: "active" | "trial",
  source: Entitlement["source"],
  plan: string | null,
  exp: number | null,
  now: number,
  limits: PlanLimits | null = null,
): Entitlement {
  if (exp !== null && exp <= now) {
    return {
      status: "expired",
      source,
      plan,
      expiresAt: exp,
      daysLeft: 0,
      canWrite: false,
      limits,
    };
  }
  return {
    status,
    source,
    plan,
    expiresAt: exp,
    daysLeft: exp === null ? null : Math.ceil((exp - now) / DAY),
    canWrite: true,
    limits,
  };
}

export function licensePublicKey() {
  return process.env.LICENSE_PUBLIC_KEY || null;
}

/** Device identity used to bind licenses (fingerprint from the desktop app). */
export async function getDeviceId(db: Executor) {
  if (process.env.TAYSSIR_DEVICE_ID) return process.env.TAYSSIR_DEVICE_ID;
  return getOrInitMeta(db, "deviceId", () => crypto.randomUUID());
}

export async function getEntitlement(
  db: Executor,
  storeId: string,
  now = Date.now(),
): Promise<Entitlement> {
  if (getMode() === "cloud") {
    let store = await getStore(db, storeId);
    // A downgrade paid in advance takes effect at the end of the paid plan.
    if (store.scheduledPlan && store.planChangesAt && store.planChangesAt.getTime() <= now) {
      [store] = await db
        .update(stores)
        .set({ plan: store.scheduledPlan, scheduledPlan: null, planChangesAt: null })
        .where(eq(stores.id, storeId))
        .returning();
    }
    const scheduled = {
      scheduledPlan: store.scheduledPlan,
      planChangesAt: store.planChangesAt?.getTime() ?? null,
    };
    if (store.subscriptionStatus === "trialing" && !store.suspendedAt) {
      // The trial includes everything.
      return fromExpiry("trial", "trial", null, store.trialEndsAt?.getTime() ?? now, now);
    }
    const limits = await limitsForPlan(db, store.plan);
    if (store.suspendedAt) {
      return {
        status: "suspended",
        source: "subscription",
        plan: store.plan,
        expiresAt: null,
        daysLeft: 0,
        canWrite: false,
        limits,
        ...scheduled,
      };
    }
    if (store.subscriptionStatus === "active" || store.subscriptionStatus === "past_due") {
      return {
        ...fromExpiry(
          "active",
          "subscription",
          store.plan,
          store.currentPeriodEnd?.getTime() ?? null,
          now,
          limits,
        ),
        ...scheduled,
      };
    }
    return {
      status: "expired",
      source: "subscription",
      plan: store.plan,
      expiresAt: null,
      daysLeft: 0,
      canWrite: false,
      limits,
    };
  }

  const publicKey = licensePublicKey();
  if (!publicKey) {
    return {
      status: "unmanaged",
      source: "none",
      plan: null,
      expiresAt: null,
      daysLeft: null,
      canWrite: true,
      limits: null,
    };
  }

  const deviceId = await getDeviceId(db);
  // A bought license, or the subscription of the linked cloud store.
  for (const key of ["licenseToken", "sync.entitlementToken"] as const) {
    const token = await getMeta(db, key);
    const payload = token ? verifyEntitlement(token, publicKey) : null;
    if (payload && payload.dev === deviceId && (payload.exp === null || payload.exp > now)) {
      return fromExpiry(
        "active",
        payload.kind,
        payload.plan,
        payload.exp,
        now,
        limitsFromToken(payload),
      );
    }
  }

  const installedAt = Number(await getOrInitMeta(db, "installedAt", () => String(now)));
  return fromExpiry("trial", "trial", null, installedAt + TRIAL_DAYS * DAY, now);
}
