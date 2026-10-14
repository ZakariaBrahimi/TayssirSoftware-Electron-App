import "server-only";
import { env } from "../env";
import { createDb, type Database } from "./client";

const globalForDb = globalThis as unknown as { db?: Database };

// Reuse the connection across hot reloads in development.
export const db = globalForDb.db ?? createDb(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN);

if (env.NODE_ENV !== "production") globalForDb.db = db;

export * as schema from "./schema";
