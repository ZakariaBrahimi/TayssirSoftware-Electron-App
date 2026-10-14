import { sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { AppError } from "../errors";
import { getDeviceId } from "../licensing/entitlements";
import { getMeta, setMeta } from "../services/meta";
import { getLocalStore } from "../services/stores";
import { applyChanges, collectChanges, enqueueAll, rehomeStore, type SyncChange } from "./engine";

/* Desktop side of the sync: links to a cloud store, pushes and pulls. */

type Fetch = typeof fetch;

async function call<T>(fetcher: Fetch, url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new AppError("SYNC_FAILED", `Cannot reach the cloud: ${(err as Error).message}`);
  }
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  if (!res.ok) {
    const code = body?.error?.code;
    if (code === "UNAUTHORIZED" || code === "FORBIDDEN") throw new AppError(code);
    throw new AppError("SYNC_FAILED", body?.error?.message ?? `Cloud error ${res.status}`);
  }
  return body as T;
}

const trimUrl = (url: string) => url.replace(/\/+$/, "");

export async function getSyncStatus(db: Database) {
  const [cloudUrl, deviceName, lastSyncAt, lastError, pushCursor] = await Promise.all([
    getMeta(db, "sync.cloudUrl"),
    getMeta(db, "sync.deviceName"),
    getMeta(db, "sync.lastSyncAt"),
    getMeta(db, "sync.lastError"),
    getMeta(db, "sync.pushCursor"),
  ]);
  const linked = Boolean(cloudUrl && (await getMeta(db, "sync.deviceToken")));
  // Local changes not pushed yet.
  const [{ pending }] = await db.all<{ pending: number }>(
    sql`select count(*) as pending from _changes where seq > ${Number(pushCursor ?? 0)}`,
  );
  return {
    linked,
    cloudUrl,
    deviceName,
    lastSyncAt: lastSyncAt ? Number(lastSyncAt) : null,
    lastError,
    pending: linked ? Number(pending) : 0,
  };
}

/**
 * Joins this install to a cloud store: the local data is moved to the
 * cloud store's id and queued for upload; the cloud's data is downloaded
 * on the next sync. Both sides then merge.
 */
export async function link(
  db: Database,
  input: { cloudUrl: string; username: string; password: string; deviceName: string },
  fetcher: Fetch = fetch,
) {
  const local = await getLocalStore(db);
  if (!local) throw new AppError("NOT_FOUND");
  const cloudUrl = trimUrl(input.cloudUrl);
  const result = await call<{
    deviceToken: string;
    deviceCode: string;
    store: { id: string; name: string };
    entitlementToken: string | null;
  }>(fetcher, `${cloudUrl}/api/sync/link`, {
    method: "POST",
    body: JSON.stringify({
      username: input.username,
      password: input.password,
      deviceName: input.deviceName,
      deviceId: await getDeviceId(db),
    }),
  });

  await rehomeStore(db, local.id, result.store.id);
  await enqueueAll(db, result.store.id);
  await Promise.all([
    setMeta(db, "sync.cloudUrl", cloudUrl),
    setMeta(db, "sync.deviceToken", result.deviceToken),
    setMeta(db, "sync.deviceName", input.deviceName),
    setMeta(db, "deviceCode", result.deviceCode),
    setMeta(db, "sync.pushCursor", "0"),
    setMeta(db, "sync.pullCursor", "0"),
    setMeta(db, "sync.lastError", null),
    setMeta(db, "sync.entitlementToken", result.entitlementToken),
  ]);
  return syncNow(db, fetcher);
}

export async function unlink(db: Database) {
  for (const key of [
    "sync.cloudUrl",
    "sync.deviceToken",
    "sync.deviceName",
    "sync.pushCursor",
    "sync.pullCursor",
    "sync.lastSyncAt",
    "sync.lastError",
    "sync.entitlementToken",
  ] as const) {
    await setMeta(db, key, null);
  }
  return getSyncStatus(db);
}

let running: Promise<unknown> | null = null;

/** Pushes local changes then pulls remote ones. Concurrent calls share one run. */
export function syncNow(db: Database, fetcher: Fetch = fetch) {
  running ??= runSync(db, fetcher).finally(() => {
    running = null;
  });
  return running.then(() => getSyncStatus(db));
}

async function runSync(db: Database, fetcher: Fetch) {
  const cloudUrl = await getMeta(db, "sync.cloudUrl");
  const token = await getMeta(db, "sync.deviceToken");
  if (!cloudUrl || !token) throw new AppError("SYNC_NOT_LINKED");
  const store = await getLocalStore(db);
  if (!store) throw new AppError("NOT_FOUND");
  const headers = { authorization: `Bearer ${token}` };
  const deviceId = await getDeviceId(db);

  try {
    // 1. Push local changes.
    let pushCursor = Number((await getMeta(db, "sync.pushCursor")) ?? 0);
    for (;;) {
      const batch = await collectChanges(db, { since: pushCursor, limit: 500 });
      if (batch.changes.length) {
        await call(fetcher, `${cloudUrl}/api/sync/push`, {
          method: "POST",
          headers,
          body: JSON.stringify({ changes: batch.changes }),
        });
      }
      pushCursor = batch.cursor;
      await setMeta(db, "sync.pushCursor", String(pushCursor));
      if (!batch.hasMore) break;
    }

    // 2. Pull remote changes.
    let pullCursor = Number((await getMeta(db, "sync.pullCursor")) ?? 0);
    for (;;) {
      const batch = await call<{
        changes: SyncChange[];
        cursor: number;
        hasMore: boolean;
        entitlementToken: string | null;
      }>(
        fetcher,
        `${cloudUrl}/api/sync/pull?cursor=${pullCursor}&deviceId=${encodeURIComponent(deviceId)}`,
        {
          method: "GET",
          headers,
        },
      );
      if (batch.changes.length) {
        await applyChanges(db, store.id, batch.changes, { suppressLog: true });
      }
      if (batch.entitlementToken)
        await setMeta(db, "sync.entitlementToken", batch.entitlementToken);
      pullCursor = batch.cursor;
      await setMeta(db, "sync.pullCursor", String(pullCursor));
      if (!batch.hasMore) break;
    }

    await setMeta(db, "sync.lastSyncAt", String(Date.now()));
    await setMeta(db, "sync.lastError", null);
  } catch (err) {
    await setMeta(db, "sync.lastError", err instanceof Error ? err.message : String(err));
    throw err;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Background sync every `intervalMs` while the install is linked. */
export function startSyncWorker(db: Database, intervalMs = 60_000) {
  if (timer) return;
  timer = setInterval(async () => {
    if (!(await getMeta(db, "sync.deviceToken"))) return;
    await syncNow(db).catch(() => {
      /* recorded in sync.lastError; retried on the next tick */
    });
  }, intervalMs);
  timer.unref?.();
}
