import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().default("file:./data/tayssir.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = schema.parse(process.env);

const isBuild = process.env.NEXT_PHASE === "phase-production-build";

/** The auth secret; mandatory when a production server is running. */
export function authSecret(): string {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  if (env.NODE_ENV === "production" && !isBuild) {
    throw new Error("BETTER_AUTH_SECRET must be set in production (at least 32 characters).");
  }
  return "dev-only-insecure-secret-do-not-use-in-production";
}
