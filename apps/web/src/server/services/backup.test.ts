import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../db/client";
import { runMigrations } from "../db/migrate";
import { stores } from "../db/schema";
import {
  applyStagedRestore,
  backupFilePath,
  createBackup,
  listBackups,
  stageRestore,
} from "./backup";
import { createStore } from "./stores";

describe("backups", () => {
  let dir: string;
  let dbFile: string;
  const env = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "tayssir-backup-"));
    dbFile = path.join(dir, "tayssir.db");
    process.env.DATABASE_URL = `file:${dbFile}`;
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("snapshots the database and restores a snapshot at the next start", async () => {
    const db = createDb(`file:${dbFile}`);
    await runMigrations(db);
    await createStore(db, { name: "Before backup", currency: "DZD" });

    const backup = await createBackup(db, "manual");
    expect(listBackups().map((b) => b.name)).toEqual([backup.name]);
    expect(() => backupFilePath("../../etc/passwd")).toThrow();

    await createStore(db, { name: "After backup", currency: "DZD" });
    await stageRestore(backupFilePath(backup.name));
    db.$client.close();

    expect(applyStagedRestore()).toBe(true);
    const restored = createDb(`file:${dbFile}`);
    expect((await restored.select().from(stores)).map((s) => s.name)).toEqual(["Before backup"]);
    // The replaced database was kept.
    expect(readdirSync(path.join(dir, "backups")).some((f) => f.endsWith("-pre-restore.db"))).toBe(
      true,
    );
    restored.$client.close();
  });

  it("refuses files that are not Tayssir databases", async () => {
    const bogus = path.join(dir, "bogus.db");
    writeFileSync(bogus, "definitely not sqlite");
    await expect(stageRestore(bogus)).rejects.toMatchObject({ code: "RESTORE_INVALID" });
    expect(existsSync(`${dbFile}.restore`)).toBe(false);
  });
});
