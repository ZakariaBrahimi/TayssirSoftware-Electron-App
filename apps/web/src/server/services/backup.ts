import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { backupsDir, localDatabasePath } from "../db/location";
import { AppError } from "../errors";
import { getMeta, setMeta } from "./meta";

/*
 * Backups of local SQLite databases (desktop app and self-hosted servers).
 * Cloud databases (Turso) rely on the provider's point-in-time recovery.
 */

const KEEP = 30;
/** "mizan-…"; "tayssir-…" files come from before the rename and stay usable. */
const NAME_RE = /^(?:mizan|tayssir)-\d{8}-\d{6}-(auto|manual|pre-migration|pre-restore)\.db$/;
const PREFIX = "mizan";

/** Newest first, by the timestamp in the name (whatever the prefix). */
const byNewest = (a: string, b: string) =>
  b.replace(/^[a-z]+-/, "").localeCompare(a.replace(/^[a-z]+-/, ""));

const stamp = (d = new Date()) =>
  d.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

function requireLocal() {
  const dbPath = localDatabasePath();
  if (!dbPath)
    throw new AppError("NOT_AVAILABLE", "Backups are only available for local databases");
  const dir = backupsDir(dbPath);
  mkdirSync(dir, { recursive: true });
  return { dbPath, dir };
}

export function backupsAvailable() {
  return localDatabasePath() !== null;
}

function prune(dir: string) {
  const files = readdirSync(dir)
    .filter((f) => NAME_RE.test(f))
    .sort(byNewest);
  for (const old of files.slice(KEEP)) rmSync(path.join(dir, old), { force: true });
}

/** Consistent snapshot of the live database (VACUUM INTO). */
export async function createBackup(db: Executor, kind: "auto" | "manual") {
  const { dir } = requireLocal();
  const name = `${PREFIX}-${stamp()}-${kind}.db`;
  const target = path.join(dir, name);
  await db.run(sql.raw(`VACUUM INTO '${target.replace(/'/g, "''")}'`));
  await setMeta(db, "lastBackupAt", String(Date.now()));
  prune(dir);
  return { name, size: statSync(target).size, createdAt: new Date() };
}

export function listBackups() {
  const { dir } = requireLocal();
  return readdirSync(dir)
    .filter((f) => NAME_RE.test(f))
    .map((name) => {
      const st = statSync(path.join(dir, name));
      return { name, size: st.size, createdAt: st.mtime };
    })
    .sort((a, b) => byNewest(a.name, b.name));
}

export function backupFilePath(name: string) {
  if (!NAME_RE.test(name)) throw new AppError("NOT_FOUND");
  const { dir } = requireLocal();
  const file = path.join(dir, name);
  if (!existsSync(file)) throw new AppError("NOT_FOUND");
  return file;
}

/** Checks that a file is a Mizan database we can restore. */
async function validateDatabaseFile(file: string) {
  const header = (await readFile(file)).subarray(0, 16).toString("latin1");
  if (header !== "SQLite format 3\u0000") throw new AppError("RESTORE_INVALID");
  const client = createClient({ url: `file:${file}` });
  try {
    const tables = await client.execute(
      "select name from sqlite_master where type = 'table' and name in ('stores', 'products', 'sales')",
    );
    if (tables.rows.length < 3) throw new AppError("RESTORE_INVALID");
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("RESTORE_INVALID");
  } finally {
    client.close();
  }
}

/**
 * Stages a restore: the file replaces the database the next time the server
 * starts (the desktop app restarts it automatically).
 */
export async function stageRestore(data: Uint8Array | string) {
  const { dbPath } = requireLocal();
  const staged = `${dbPath}.restore`;
  const tmp = `${staged}.tmp`;
  if (typeof data === "string") await copyFile(data, tmp);
  else await writeFile(tmp, data);
  try {
    await validateDatabaseFile(tmp);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  renameSync(tmp, staged);
  return { staged: true };
}

/** Runs at boot, before the database is opened. */
export function applyStagedRestore() {
  const dbPath = localDatabasePath();
  if (!dbPath || !existsSync(`${dbPath}.restore`)) return false;
  const dir = backupsDir(dbPath);
  mkdirSync(dir, { recursive: true });
  if (existsSync(dbPath)) renameSync(dbPath, path.join(dir, `${PREFIX}-${stamp()}-pre-restore.db`));
  for (const suffix of ["-wal", "-shm", "-journal"]) rmSync(`${dbPath}${suffix}`, { force: true });
  renameSync(`${dbPath}.restore`, dbPath);
  return true;
}

/** Copies the database file before migrations change its schema. */
export async function backupBeforeMigration(pendingMigrations: number) {
  const dbPath = localDatabasePath();
  if (!dbPath || !existsSync(dbPath) || pendingMigrations === 0) return null;
  const dir = backupsDir(dbPath);
  mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `${PREFIX}-${stamp()}-pre-migration.db`);
  await copyFile(dbPath, target);
  return target;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Daily automatic backup (checked hourly). */
export function startAutoBackup(db: Executor) {
  if (timer || !backupsAvailable()) return;
  const tick = async () => {
    const last = Number((await getMeta(db, "lastBackupAt")) ?? 0);
    if (Date.now() - last > 24 * 3_600_000) await createBackup(db, "auto").catch(() => {});
  };
  void tick();
  timer = setInterval(tick, 3_600_000);
  timer.unref?.();
}
