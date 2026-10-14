import { zValidator } from "@hono/zod-validator";
import { createMiddleware } from "hono/factory";
import type { ValidationTargets } from "hono";
import type { z } from "zod";
import { auth, type Session } from "../auth";
import { AppError } from "../errors";

export type AppEnv = {
  Variables: {
    user: Session["user"];
    session: Session["session"];
  };
};

/** Rejects unauthenticated requests and exposes the user on the context. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result || result.user.banned) throw new AppError("UNAUTHORIZED");
  c.set("user", result.user);
  c.set("session", result.session);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user")?.role !== "admin") throw new AppError("FORBIDDEN");
  await next();
});

export const isAdmin = (u: { role?: string | null }) => u.role === "admin";

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
