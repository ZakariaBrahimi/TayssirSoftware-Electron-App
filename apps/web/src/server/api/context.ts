import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { createMiddleware } from "hono/factory";
import type { z } from "zod";
import { auth, type Session } from "../auth";
import { type Ctx, getMode, type Mode } from "../context";
import { db } from "../db";
import { AppError } from "../errors";
import { getEntitlement } from "../licensing/entitlements";

export type AppEnv = {
  Variables: {
    user: Session["user"] & { storeId?: string | null };
    session: Session["session"];
    ctx: Ctx;
  };
};

/** Rejects unauthenticated requests and exposes the user and store context. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  // Always read the session from the database (not the signed cookie cache):
  // a user's store or role can change (sync linking, admin edits) and must
  // take effect immediately. It is a cheap primary-key lookup.
  const result = await auth.api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  });
  if (!result || result.user.banned) throw new AppError("UNAUTHORIZED");
  const user = result.user as AppEnv["Variables"]["user"];
  if (!user.storeId) throw new AppError("FORBIDDEN");
  c.set("user", user);
  c.set("session", result.session);
  c.set("ctx", { storeId: user.storeId, userId: user.id, userName: user.name });
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user")?.role !== "admin") throw new AppError("FORBIDDEN");
  await next();
});

export const isAdmin = (u: { role?: string | null }) => u.role === "admin";

/**
 * Blocks changes when the license (local) or subscription (cloud) has
 * expired. Reading, exporting and backups keep working.
 */
export const requireEntitlement = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const ent = await getEntitlement(db, c.get("ctx").storeId);
    if (!ent.canWrite) throw new AppError("LICENSE_REQUIRED");
  }
  await next();
});

/** Restricts a route group to one deployment mode. */
export const onlyMode = (mode: Mode) =>
  createMiddleware(async (_c, next) => {
    if (getMode() !== mode) throw new AppError("NOT_AVAILABLE");
    await next();
  });

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Simple fixed-window rate limit per client IP (in-memory). */
export const rateLimit = (name: string, limit: number, windowMs: number) =>
  createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "local";
    const key = `${name}:${ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
    } else if (++bucket.count > limit) {
      throw new AppError("RATE_LIMITED");
    }
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
    }
    await next();
  });

/** zod validator that reports failures in the API's error format. */
export function validate<T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR" as const,
            message: "Invalid request",
            details: { issues: result.error.issues },
          },
        },
        400,
      );
    }
  });
}
