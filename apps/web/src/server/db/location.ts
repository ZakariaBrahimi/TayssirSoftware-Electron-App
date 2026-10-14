import path from "node:path";

/** Resolved location of a local SQLite database, or null (remote/in-memory). */
export function localDatabasePath(url = process.env.DATABASE_URL ?? "file:./data/tayssir.db") {
  if (!url.startsWith("file:") || url.includes(":memory:")) return null;
  return path.resolve(url.slice("file:".length));
}

export function backupsDir(dbPath: string) {
  return path.join(path.dirname(dbPath), "backups");
}
