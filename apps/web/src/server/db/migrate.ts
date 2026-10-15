import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb, type Database } from "./client";

export const MIGRATIONS_FOLDER = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

export async function runMigrations(db: Database) {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

/** Number of migrations not yet applied to the database at `url`. */
export async function pendingMigrations(url: string, authToken?: string) {
  const journal = JSON.parse(
    readFileSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8"),
  ) as { entries: unknown[] };
  const client = createClient({ url, authToken });
  try {
    const exists = await client.execute(
      "select 1 from sqlite_master where type = 'table' and name = '__drizzle_migrations'",
    );
    if (!exists.rows.length) return { pending: journal.entries.length, fresh: true };
    const applied = await client.execute("select count(*) as n from __drizzle_migrations");
    return { pending: journal.entries.length - Number(applied.rows[0].n), fresh: false };
  } finally {
    client.close();
  }
}

// Allow `npm run db:migrate`
if (process.argv[1]?.endsWith("migrate.ts")) {
  const db = createDb(
    process.env.DATABASE_URL ?? "file:./data/tayssir.db",
    process.env.DATABASE_AUTH_TOKEN,
  );
  runMigrations(db)
    .then(() => console.log("✔ Migrations applied"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
