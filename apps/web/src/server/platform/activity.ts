import { sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { storeActivity } from "../db/schema";

const THROTTLE_MS = 5 * 60_000;
const lastWrite = new Map<string, number>();

/**
 * Records that a store is in use (web request or device sync). Written at
 * most every few minutes per store, so it costs nothing on hot paths.
 */
export async function touchStore(db: Executor, storeId: string, now = Date.now()) {
  const last = lastWrite.get(storeId);
  if (last && now - last < THROTTLE_MS) return;
  lastWrite.set(storeId, now);
  if (lastWrite.size > 50_000) lastWrite.clear();
  await db
    .insert(storeActivity)
    .values({ storeId, lastSeenAt: new Date(now) })
    .onConflictDoUpdate({
      target: storeActivity.storeId,
      set: { lastSeenAt: sql`excluded.last_seen_at` },
    });
}

/** Test helper. */
export function resetActivityThrottle() {
  lastWrite.clear();
}
