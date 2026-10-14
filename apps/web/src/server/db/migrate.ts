import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb, type Database } from "./client";

export const MIGRATIONS_FOLDER = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

export async function runMigrations(db: Database) {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
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
