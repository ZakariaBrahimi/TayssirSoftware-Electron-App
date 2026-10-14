import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { db, schema } from "./db";
import { authSecret, env } from "./env";

export const auth = betterAuth({
  appName: "Tayssir POS",
  secret: authSecret(),
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    // Accounts are created by an administrator (or by the first-run setup),
    // never through public sign-up.
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 32 }),
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
