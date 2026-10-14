import type { Database } from "../db/client";
import { getMeta, setMeta } from "../services/meta";
import { appVersion, VERSION_HEADER } from "../version";

/* Desktop side: keeps an activated license in step with the license server. */

export function licenseServerUrl() {
  return (process.env.LICENSE_SERVER_URL ?? "").replace(/\/+$/, "");
}

/**
 * Checks the license in with the server: picks up renewals and plan
 * changes, and drops the license when it was revoked. Offline: no change,
 * the signed token keeps working until its end date.
 */
export async function refreshLicense(db: Database, fetcher: typeof fetch = fetch) {
  const server = licenseServerUrl();
  const token = await getMeta(db, "licenseToken");
  if (!server || !token) return "skipped" as const;
  let res: Response;
  try {
    res = await fetcher(`${server}/api/licenses/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", [VERSION_HEADER]: appVersion() },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return "offline" as const;
  }
  const body = (await res.json().catch(() => null)) as {
    status?: "ok" | "revoked";
    token?: string | null;
  } | null;
  if (!res.ok || !body?.status) return "offline" as const;
  if (body.status === "revoked") {
    await setMeta(db, "licenseToken", null);
    return "revoked" as const;
  }
  if (body.token) await setMeta(db, "licenseToken", body.token);
  return "ok" as const;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Checks in shortly after start, then every `intervalMs` (default 12 hours). */
export function startLicenseWorker(db: Database, intervalMs = 12 * 60 * 60_000) {
  if (timer) return;
  const run = () => void refreshLicense(db).catch(() => {});
  setTimeout(run, 30_000).unref?.();
  timer = setInterval(run, intervalMs);
  timer.unref?.();
}
