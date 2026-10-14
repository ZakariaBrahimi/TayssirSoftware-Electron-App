export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Fail fast on a misconfigured production server (missing auth secret).
  const { authSecret } = await import("./server/env");
  authSecret();

  // Apply pending database migrations once when the server boots, so a fresh
  // install (desktop or self-hosted) works without a manual step.
  if (process.env.SKIP_DB_MIGRATIONS !== "true") {
    const { db } = await import("./server/db");
    const { runMigrations } = await import("./server/db/migrate");
    await runMigrations(db);
  }
}
