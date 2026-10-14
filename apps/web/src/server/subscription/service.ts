import { and, count, eq, isNull } from "drizzle-orm";
import type { PaymentRequestInput } from "@/lib/validators/platform";
import { getMode } from "../context";
import type { Database } from "../db/client";
import { syncDevices, user } from "../db/schema";
import { AppError } from "../errors";
import { activateWithKey, licenseServerUrl, refreshLicense } from "../licensing/client";
import { getDeviceId, getEntitlement } from "../licensing/entitlements";
import type { PublicCatalog } from "../platform/billing";
import { getMeta } from "../services/meta";
import { getStore } from "../services/stores";
import { appVersion, VERSION_HEADER } from "../version";

/*
 * The shop's "My subscription" page. In the cloud it reads the billing
 * tables directly; on a desktop it asks the cloud (as the linked store,
 * as its license, or as an unlicensed PC).
 */

type OwnRequests = Awaited<ReturnType<typeof import("../platform/billing").listOwnRequests>>;

async function usage(db: Database, storeId: string) {
  const [[users], [devices]] = await Promise.all([
    db.select({ n: count() }).from(user).where(eq(user.storeId, storeId)),
    getMode() === "cloud"
      ? db
          .select({ n: count() })
          .from(syncDevices)
          .where(and(eq(syncDevices.storeId, storeId), isNull(syncDevices.revokedAt)))
      : Promise.resolve([{ n: null as number | null }]),
  ]);
  return { users: users.n, devices: devices.n };
}

/* --------------------------------- Desktop -------------------------------- */

/** How this PC identifies itself to the cloud's billing endpoints. */
async function desktopCredentials(db: Database) {
  const [cloudUrl, deviceToken, licenseToken] = await Promise.all([
    getMeta(db, "sync.cloudUrl"),
    getMeta(db, "sync.deviceToken"),
    getMeta(db, "licenseToken"),
  ]);
  const server = (cloudUrl && deviceToken ? cloudUrl : licenseServerUrl()) || null;
  const headers: Record<string, string> = { [VERSION_HEADER]: appVersion() };
  if (cloudUrl && deviceToken) headers.authorization = `Bearer ${deviceToken}`;
  else if (licenseToken) headers["x-license-token"] = licenseToken;
  else headers["x-device-id"] = await getDeviceId(db);
  return { server, headers, linked: Boolean(cloudUrl && deviceToken) };
}

async function cloudCall<T>(
  url: string,
  init: RequestInit & { headers: Record<string, string> },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new AppError("SYNC_FAILED", "Cannot reach the Mizan cloud");
  }
  const body = (await res.json().catch(() => null)) as
    (T & { error?: { code?: string; message?: string; details?: Record<string, unknown> } }) | null;
  if (!res.ok) {
    const code = body?.error?.code;
    const known = [
      "PRICE_NOT_SET",
      "REQUEST_PENDING",
      "NOT_FOUND",
      "VALIDATION_ERROR",
      "RATE_LIMITED",
    ];
    throw new AppError(
      (known.includes(code ?? "") ? code : "SYNC_FAILED") as "SYNC_FAILED",
      body?.error?.message,
    );
  }
  return body as T;
}

let catalogCache: { at: number; value: PublicCatalog } | null = null;

async function desktopCatalog(server: string) {
  if (catalogCache && Date.now() - catalogCache.at < 5 * 60_000) return catalogCache.value;
  const value = await cloudCall<PublicCatalog>(`${server}/api/billing/catalog`, {
    method: "GET",
    headers: {},
  });
  catalogCache = { at: Date.now(), value };
  return value;
}

/* ---------------------------------- Both ---------------------------------- */

export async function getSubscription(db: Database, storeId: string) {
  const mode = getMode();
  if (mode === "cloud") {
    const billing = await import("../platform/billing");
    const [entitlement, catalog, own, payments, used] = await Promise.all([
      getEntitlement(db, storeId),
      billing.publicCatalog(db),
      billing.listOwnRequests(db, { type: "store", storeId }),
      billing.storePayments(db, storeId),
      usage(db, storeId),
    ]);
    return {
      mode,
      kind: "subscription" as const,
      online: true,
      entitlement,
      catalog,
      requests: own.requests,
      payments,
      usage: used,
    };
  }

  const creds = await desktopCredentials(db);
  const kind = creds.linked ? ("subscription" as const) : ("license" as const);
  let catalog: PublicCatalog | null = null;
  let requests: OwnRequests["requests"] = [];
  let online = false;
  if (creds.server) {
    try {
      catalog = await desktopCatalog(creds.server);
      const own = await cloudCall<OwnRequests>(`${creds.server}/api/billing/requests`, {
        method: "GET",
        headers: creds.headers,
      });
      requests = own.requests;
      online = true;
      // A license bought from this PC arrives here once: activate it.
      if (own.licenseKey) await activateWithKey(db, own.licenseKey);
      // Pick up an approved upgrade now rather than at the next check-in.
      else if (!creds.linked) await refreshLicense(db);
    } catch {
      online = false;
    }
  }
  return {
    mode,
    kind,
    online,
    entitlement: await getEntitlement(db, storeId),
    catalog,
    requests,
    payments: [],
    usage: await usage(db, storeId),
  };
}
export type Subscription = Awaited<ReturnType<typeof getSubscription>>;

export async function sendRequest(db: Database, storeId: string, input: PaymentRequestInput) {
  const store = await getStore(db, storeId);
  const withShop = { ...input, shopName: input.shopName || store.name };
  if (getMode() === "cloud") {
    const { createRequest } = await import("../platform/billing");
    return createRequest(db, { type: "store", storeId }, withShop);
  }
  const creds = await desktopCredentials(db);
  if (!creds.server) throw new AppError("NOT_AVAILABLE");
  return cloudCall(`${creds.server}/api/billing/requests`, {
    method: "POST",
    headers: creds.headers,
    body: JSON.stringify(withShop),
  });
}

export async function cancelRequest(db: Database, storeId: string, id: string) {
  if (getMode() === "cloud") {
    const { cancelOwnRequest } = await import("../platform/billing");
    return cancelOwnRequest(db, { type: "store", storeId }, id);
  }
  const creds = await desktopCredentials(db);
  if (!creds.server) throw new AppError("NOT_AVAILABLE");
  return cloudCall(`${creds.server}/api/billing/requests/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: creds.headers,
  });
}
