import { createMiddleware } from "hono/factory";
import { auth } from "../auth";
import { AppError } from "../errors";
import { type Actor, isPlatformAdmin } from "../platform/access";

export type PlatformUser = {
  id: string;
  name: string;
  username: string;
  twoFactorEnabled: boolean;
};

export type PlatformEnv = {
  Variables: { platformUser: PlatformUser; actor: Actor };
};

/** Console sessions must be recent: a stolen cookie is useful for 12 hours at most. */
const MAX_SESSION_AGE_MS = 12 * 60 * 60_000;

const clientIp = (header: (name: string) => string | undefined) =>
  header("x-forwarded-for")?.split(",")[0]?.trim() || header("x-real-ip") || null;

/**
 * Platform owner only. Anyone else gets a 404, so the console's existence
 * is not revealed to store users.
 */
export const requirePlatformAdmin = createMiddleware<PlatformEnv>(async (c, next) => {
  const result = await auth.api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  });
  if (!result) throw new AppError("UNAUTHORIZED");
  const u = result.user as typeof result.user & {
    username?: string | null;
    storeId?: string | null;
    role?: string | null;
    banned?: boolean | null;
    twoFactorEnabled?: boolean | null;
  };
  if (u.banned || !isPlatformAdmin(u)) throw new AppError("NOT_FOUND");
  if (Date.now() - new Date(result.session.createdAt).getTime() > MAX_SESSION_AGE_MS) {
    throw new AppError("UNAUTHORIZED");
  }
  c.set("platformUser", {
    id: u.id,
    name: u.name,
    username: u.username!,
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
  });
  c.set("actor", { id: u.id, name: u.username!, ip: clientIp((n) => c.req.header(n)) });
  await next();
});

/** Everything but the 2FA setup needs an authenticator app enrolled. */
export const requireTwoFactor = createMiddleware<PlatformEnv>(async (c, next) => {
  if (!c.get("platformUser").twoFactorEnabled) throw new AppError("TWO_FACTOR_REQUIRED");
  await next();
});
