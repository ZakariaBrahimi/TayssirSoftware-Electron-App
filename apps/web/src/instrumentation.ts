export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Fail fast on a misconfigured production server (missing auth secret).
  const { authSecret, env } = await import("./server/env");
  authSecret();

  const backup = await import("./server/services/backup");
  const { getMode } = await import("./server/context");

  // 1. A restore staged from the settings page replaces the database now,
  //    before anything opens it.
  if (backup.applyStagedRestore()) console.log("✔ Database restored from backup");

  if (process.env.SKIP_DB_MIGRATIONS !== "true") {
    // 2. Keep a copy of the database before its schema changes (updates).
    const { pendingMigrations, runMigrations } = await import("./server/db/migrate");
    const { pending, fresh } = await pendingMigrations(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN);
    if (!fresh) await backup.backupBeforeMigration(pending);
    // 3. Apply migrations.
    const { db } = await import("./server/db");
    await runMigrations(db);
  }

  if (getMode() === "local") {
    const { db } = await import("./server/db");
    backup.startAutoBackup(db);
    const { startSyncWorker } = await import("./server/sync/client");
    startSyncWorker(db, Number(process.env.SYNC_INTERVAL_MS) || 60_000);
  }
}
