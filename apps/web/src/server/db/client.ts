import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export function createDb(url: string, authToken?: string) {
  if (url.startsWith("file:") && !url.includes(":memory:")) {
    mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });
  }
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything that can run queries: the database or an open transaction. */
export type Executor = Database | Transaction;
