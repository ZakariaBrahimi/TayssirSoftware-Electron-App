import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor, username } from "better-auth/plugins";
import { db, schema } from "./db";
import { authSecret, env } from "./env";

export const auth = betterAuth({
  appName: "Mizan POS",
  secret: authSecret(),
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
    },
  }),
  user: {
    additionalFields: {
      // The store the user belongs to. Set by the server only.
      storeId: { type: "string", required: false, input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    // Accounts are created by the server (setup, sign-up, store admins),
    // never through Better Auth's public sign-up endpoint.
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 32 }),
    // Provides roles. Its HTTP endpoints are blocked (see api/index.ts):
    // they are not store-aware, so user management goes through /api/users.
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    // Authenticator app codes. Required for the platform console, optional
    // for everyone else.
    twoFactor({ issuer: "Mizan POS" }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
