import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";
import { eq, sql } from "drizzle-orm";
import type { Database, Executor } from "../db/client";
import { changes, SYNC_TABLES, syncState, type SyncTableName } from "../db/schema";
import { AppError } from "../errors";
import { recomputeStock } from "../services/stock";

/**
 * Change-based replication between two databases with the same schema
 * (a desktop install and its cloud store).
 *
 * - Every insert/update of a synced row is recorded in `_changes` by
 *   triggers. A batch = the latest version of each changed row, in order.
 * - Applying a batch upserts rows with last-write-wins on `updated_at`;
 *   equal timestamps are no-ops, so echoes of our own changes are harmless.
 * - Columns owned by one side are never overwritten by the other
 *   (cloud subscription fields; the stock cache, rebuilt from movements).
 */

export type SyncRow = Record<string, string | number | null>;
export type SyncChange = { tbl: SyncTableName; row: SyncRow };

const IGNORED_ON_APPLY: Partial<Record<SyncTableName, string[]>> = {
  stores: ["plan", "subscription_status", "trial_ends_at", "current_period_end"],
  products: ["stock"],
};

const columnCache = new Map<string, string[]>();
function columnsOf(name: SyncTableName) {
  let cols = columnCache.get(name);
  if (!cols) {
    cols = getTableConfig(SYNC_TABLES[name] as SQLiteTable).columns.map((c) => c.name);
    columnCache.set(name, cols);
  }
  return cols;
}

const isSyncTable = (name: string): name is SyncTableName =>
  Object.prototype.hasOwnProperty.call(SYNC_TABLES, name);

/** Reads up to `limit` changes after `since` (optionally for one store). */
export async function collectChanges(
  db: Executor,
  opts: { since: number; storeId?: string; limit?: number },
) {
  const limit = opts.limit ?? 500;
  const log = await db
    .select()
    .from(changes)
    .where(
      opts.storeId
        ? sql`${changes.seq} > ${opts.since} and ${changes.storeId} = ${opts.storeId}`
        : sql`${changes.seq} > ${opts.since}`,
    )
    .orderBy(changes.seq)
    .limit(limit + 1);

  const hasMore = log.length > limit;
  const page = log.slice(0, limit);
  const cursor = page.length ? page[page.length - 1].seq : opts.since;

  // Keep each row once, at its last position (latest version wins anyway).
  const lastIndex = new Map<string, number>();
  page.forEach((c, i) => lastIndex.set(`${c.tbl}:${c.rowId}`, i));
  const ordered = page.filter(
    (c, i) => lastIndex.get(`${c.tbl}:${c.rowId}`) === i && isSyncTable(c.tbl),
  );

  // Load current row versions, one query per table.
  const idsByTable = new Map<SyncTableName, string[]>();
  for (const c of ordered) {
    const tbl = c.tbl as SyncTableName;
    idsByTable.set(tbl, [...(idsByTable.get(tbl) ?? []), c.rowId]);
  }
  const rows = new Map<string, SyncRow>();
  for (const [tbl, ids] of idsByTable) {
    const result = await db.all<SyncRow>(
      sql`select * from ${sql.identifier(tbl)} where id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
    for (const row of result) rows.set(`${tbl}:${row.id}`, row);
  }

  const out: SyncChange[] = [];
  for (const c of ordered) {
    const row = rows.get(`${c.tbl}:${c.rowId}`);
    if (row) out.push({ tbl: c.tbl as SyncTableName, row });
  }
  return { changes: out, cursor, hasMore };
}

function sanitizeRow(tbl: SyncTableName, row: unknown, storeId: string): SyncRow {
  if (!row || typeof row !== "object") throw new AppError("VALIDATION_ERROR", "Invalid row");
  const input = row as Record<string, unknown>;
  const out: SyncRow = {};
  for (const col of columnsOf(tbl)) {
    if (!(col in input)) continue;
    const value = input[col];
    if (value !== null && typeof value !== "string" && typeof value !== "number") {
      throw new AppError("VALIDATION_ERROR", `Invalid value for ${tbl}.${col}`);
    }
    out[col] = value;
  }
  if (typeof out.id !== "string" || typeof out.updated_at !== "number") {
    throw new AppError("VALIDATION_ERROR", `Row of ${tbl} without id/updated_at`);
  }
  // A device may only write rows of its own store.
  const owner = tbl === "stores" ? out.id : out.store_id;
  if (owner !== storeId) throw new AppError("FORBIDDEN", `Row of ${tbl} belongs to another store`);
  return out;
}

async function upsert(db: Executor, tbl: SyncTableName, row: SyncRow) {
  const ignored = new Set(IGNORED_ON_APPLY[tbl] ?? []);
  const cols = Object.keys(row).filter((c) => !ignored.has(c));
  const updatable = cols.filter((c) => c !== "id");
  const t = sql.identifier(tbl);
  const ownerCheck = tbl === "stores" ? sql`` : sql` and ${t}.store_id = excluded.store_id`;

  await db.run(sql`
    insert into ${t} (${sql.join(
      cols.map((c) => sql.identifier(c)),
      sql`, `,
    )})
    values (${sql.join(
      cols.map((c) => sql`${row[c]}`),
      sql`, `,
    )})
    on conflict(id) do update set ${sql.join(
      updatable.map((c) => sql`${sql.identifier(c)} = excluded.${sql.identifier(c)}`),
      sql`, `,
    )}
    where excluded.updated_at > ${t}.updated_at${ownerCheck}
  `);
}

/**
 * Applies remote changes for one store. With `suppressLog`, the triggers
 * don't record them (a desktop applying what it pulled must not push it
 * back); the cloud keeps logging so other devices receive them.
 */
export async function applyChanges(
  db: Database,
  storeId: string,
  incoming: { tbl: string; row: unknown }[],
  opts: { suppressLog: boolean },
) {
  const valid: SyncChange[] = incoming.map((c) => {
    if (!isSyncTable(c.tbl)) throw new AppError("VALIDATION_ERROR", `Unknown table ${c.tbl}`);
    return { tbl: c.tbl, row: sanitizeRow(c.tbl, c.row, storeId) };
  });

  await db.transaction(async (tx) => {
    if (opts.suppressLog)
      await tx.update(syncState).set({ applying: 1 }).where(eq(syncState.id, 1));
    const touchedProducts = new Set<string>();
    for (const change of valid) {
      await upsert(tx, change.tbl, change.row);
      if (change.tbl === "stock_movements") touchedProducts.add(String(change.row.product_id));
      if (change.tbl === "products") touchedProducts.add(String(change.row.id));
    }
    // Stock is derived: rebuild the cache from the merged movement ledger.
    await recomputeStock(tx, [...touchedProducts]);
    if (opts.suppressLog)
      await tx.update(syncState).set({ applying: 0 }).where(eq(syncState.id, 1));
  });

  return { applied: valid.length };
}

/** Queues every row of a store for pushing (first sync after linking). */
export async function enqueueAll(db: Executor, storeId: string) {
  for (const tbl of Object.keys(SYNC_TABLES) as SyncTableName[]) {
    const owner = tbl === "stores" ? sql`id` : sql`store_id`;
    await db.run(
      sql`insert into ${changes} (tbl, row_id, store_id)
          select ${tbl}, id, ${storeId} from ${sql.identifier(tbl)} where ${owner} = ${storeId}`,
    );
  }
}

/** Moves all data of a store to a new store id (joining a cloud store). */
export async function rehomeStore(db: Database, fromId: string, toId: string) {
  if (fromId === toId) return;
  await db.transaction(async (tx) => {
    await tx.update(syncState).set({ applying: 1 }).where(eq(syncState.id, 1));
    for (const tbl of Object.keys(SYNC_TABLES) as SyncTableName[]) {
      if (tbl === "stores") continue;
      await tx.run(
        sql`update ${sql.identifier(tbl)} set store_id = ${toId} where store_id = ${fromId}`,
      );
    }
    // updated_at = 0: the cloud's store settings win over the local ones.
    await tx.run(sql`update stores set id = ${toId}, updated_at = 0 where id = ${fromId}`);
    await tx.run(sql`update user set store_id = ${toId} where store_id = ${fromId}`);
    await tx.run(sql`delete from ${changes} where store_id = ${fromId}`);
    await tx.update(syncState).set({ applying: 0 }).where(eq(syncState.id, 1));
  });
}
