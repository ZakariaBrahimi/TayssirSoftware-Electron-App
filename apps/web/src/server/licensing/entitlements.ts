import { getMode } from "../context";
import type { Executor } from "../db/client";
import { getMeta, getOrInitMeta } from "../services/meta";
import { getStore, TRIAL_DAYS } from "../services/stores";
import { verifyEntitlement } from "./token";

export type Entitlement = {
  /** "unmanaged": licensing is not enforced by this build. */
  status: "active" | "trial" | "expired" | "suspended" | "unmanaged";
  source: "license" | "subscription" | "trial" | "none";
  plan: string | null;
  expiresAt: number | null;
  daysLeft: number | null;
  /** False when the store may only read data (expired license/subscription). */
  canWrite: boolean;
};

const DAY = 86_400_000;

function fromExpiry(
  status: "active" | "trial",
  source: Entitlement["source"],
  plan: string | null,
  exp: number | null,
  now: number,
): Entitlement {
  if (exp !== null && exp <= now) {
    return { status: "expired", source, plan, expiresAt: exp, daysLeft: 0, canWrite: false };
  }
  return {
    status,
    source,
    plan,
    expiresAt: exp,
    daysLeft: exp === null ? null : Math.ceil((exp - now) / DAY),
    canWrite: true,
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
    const store = await getStore(db, storeId);
    if (store.suspendedAt) {
      return {
        status: "suspended",
        source: "subscription",
        plan: store.plan,
        expiresAt: null,
        daysLeft: 0,
        canWrite: false,
      };
    }
    if (store.subscriptionStatus === "active" || store.subscriptionStatus === "past_due") {
      return fromExpiry(
        "active",
        "subscription",
        store.plan,
        store.currentPeriodEnd?.getTime() ?? null,
        now,
      );
    }
    if (store.subscriptionStatus === "trialing") {
      return fromExpiry("trial", "trial", null, store.trialEndsAt?.getTime() ?? now, now);
    }
    return {
      status: "expired",
      source: "subscription",
      plan: store.plan,
      expiresAt: null,
      daysLeft: 0,
      canWrite: false,
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
    };
  }

  const deviceId = await getDeviceId(db);
  // A bought license, or the subscription of the linked cloud store.
  for (const key of ["licenseToken", "sync.entitlementToken"] as const) {
    const token = await getMeta(db, key);
    const payload = token ? verifyEntitlement(token, publicKey) : null;
    if (payload && payload.dev === deviceId && (payload.exp === null || payload.exp > now)) {
      return fromExpiry("active", payload.kind, payload.plan, payload.exp, now);
    }
  }

  const installedAt = Number(await getOrInitMeta(db, "installedAt", () => String(now)));
  return fromExpiry("trial", "trial", null, installedAt + TRIAL_DAYS * DAY, now);
}
