/**
 * Vendor administration (run on the cloud server):
 *
 *   npm run admin -- keys:generate
 *   npm run admin -- license:create --plan pro --devices 2 --days 365 --customer "Superette X"
 *   npm run admin -- license:list
 *   npm run admin -- license:revoke <id|last-4-chars>
 *   npm run admin -- license:reset <id|last-4-chars>     (frees its device slots)
 *   npm run admin -- store:list
 *   npm run admin -- store:subscription <storeId> --status active --plan pro --until 2027-01-31
 *   npm run admin -- platform:admin <username> [--name "Your Name"] [--password ...]
 *   npm run admin -- platform:2fa-reset <username>      (lost authenticator)
 *
 * License and store changes are written to the console's audit log as "CLI".
 */
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { endOfDay } from "@/lib/validators/platform";
import { createDb } from "../db/client";
import {
  account,
  licenseActivations,
  licenses,
  session,
  stores,
  SUBSCRIPTION_STATUSES,
  twoFactor,
  user,
  type SubscriptionStatus,
} from "../db/schema";
import { generateSigningKeys } from "../licensing/token";
import { CLI_ACTOR, PLATFORM_ROLE, platformAdminUsernames } from "../platform/access";
import { createLicense, removeActivations, setLicenseRevoked } from "../platform/licenses";
import { setSubscription } from "../platform/stores";

const [command, ...rest] = process.argv.slice(2);
const flags = new Map<string, string>();
const positional: string[] = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    flags.set(rest[i].slice(2), rest[i + 1] ?? "true");
    i++;
  } else {
    positional.push(rest[i]);
  }
}

const db = createDb(
  process.env.DATABASE_URL ?? "file:./data/tayssir.db",
  process.env.DATABASE_AUTH_TOKEN,
);

async function findLicense(ref: string) {
  const rows = await db
    .select()
    .from(licenses)
    .where(or(eq(licenses.id, ref), eq(licenses.keyHint, ref.toUpperCase())));
  if (rows.length !== 1)
    throw new Error(rows.length ? "Ambiguous: use the license id" : "License not found");
  return rows[0];
}

async function main() {
  switch (command) {
    case "keys:generate": {
      const { privateKey, publicKey } = generateSigningKeys();
      console.log("Keep the private key secret (cloud server only):\n");
      console.log(`LICENSE_PRIVATE_KEY=${Buffer.from(privateKey).toString("base64")}\n`);
      console.log("Public key (cloud server AND desktop builds):\n");
      console.log(`LICENSE_PUBLIC_KEY=${Buffer.from(publicKey).toString("base64")}`);
      return;
    }
    case "license:create": {
      const days = flags.get("days");
      const { key, license } = await createLicense(db, CLI_ACTOR, {
        plan: flags.get("plan") ?? "standard",
        maxDevices: Number(flags.get("devices") ?? 1),
        days: days ? Number(days) : null,
        customerName: flags.get("customer"),
      });
      console.log(
        `License ${license.id}\n  key:     ${key}\n  plan:    ${license.plan}\n  devices: ${license.maxDevices}\n  expires: ${license.expiresAt?.toISOString() ?? "never"}`,
      );
      console.log("\nThe key is shown only once: send it to the customer now.");
      return;
    }
    case "license:list": {
      const rows = await db.select().from(licenses).orderBy(desc(licenses.createdAt));
      for (const l of rows) {
        const used = await db
          .select()
          .from(licenseActivations)
          .where(eq(licenseActivations.licenseId, l.id));
        console.log(
          `${l.id}  …${l.keyHint}  ${l.plan.padEnd(10)} ${used.length}/${l.maxDevices} devices  ` +
            `${l.revokedAt ? "REVOKED" : (l.expiresAt?.toISOString().slice(0, 10) ?? "lifetime")}  ${l.customerName ?? ""}`,
        );
      }
      return;
    }
    case "license:revoke": {
      const l = await findLicense(positional[0]);
      await setLicenseRevoked(db, CLI_ACTOR, l.id, true);
      console.log(`Revoked ${l.id}. Activated installs lose it at their next check-in.`);
      return;
    }
    case "license:reset": {
      const l = await findLicense(positional[0]);
      await removeActivations(db, CLI_ACTOR, l.id);
      console.log(`Freed all device slots of ${l.id}.`);
      return;
    }
    case "store:list": {
      for (const s of await db.select().from(stores).orderBy(desc(stores.createdAt))) {
        const until = s.subscriptionStatus === "trialing" ? s.trialEndsAt : s.currentPeriodEnd;
        console.log(
          `${s.id}  ${s.name.padEnd(30)} ${s.subscriptionStatus.padEnd(9)} ${s.plan.padEnd(8)} ${until?.toISOString().slice(0, 10) ?? ""}`,
        );
      }
      return;
    }
    case "store:subscription": {
      const status = (flags.get("status") ?? "active") as SubscriptionStatus;
      if (!SUBSCRIPTION_STATUSES.includes(status))
        throw new Error(`--status must be one of ${SUBSCRIPTION_STATUSES.join(", ")}`);
      const until = flags.get("until");
      const row = await setSubscription(db, CLI_ACTOR, positional[0], {
        status,
        plan: flags.get("plan"),
        currentPeriodEnd: until ? endOfDay(until) : undefined,
      });
      console.log(
        `${row.name}: ${row.subscriptionStatus} (${row.plan}) until ${row.currentPeriodEnd?.toISOString() ?? "—"}`,
      );
      return;
    }
    case "platform:admin": {
      const username = positional[0]?.trim().toLowerCase();
      if (!username || !/^[a-z0-9_.]{3,32}$/.test(username))
        throw new Error("Usage: platform:admin <username> [--name ...] [--password ...]");
      const [taken] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.username, username));
      if (taken) throw new Error(`Username "${username}" is already used`);
      const password = flags.get("password") ?? randomBytes(12).toString("base64url");
      if (password.length < 10) throw new Error("Use a password of at least 10 characters");
      const id = crypto.randomUUID();
      const now = new Date();
      await db.insert(user).values({
        id,
        name: flags.get("name") ?? username,
        email: `${username}@platform.tayssir.local`,
        username,
        displayUsername: username,
        role: PLATFORM_ROLE,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: await hashPassword(password),
        createdAt: now,
        updatedAt: now,
      });
      console.log(`Platform admin "${username}" created.`);
      if (!flags.has("password"))
        console.log(`  password: ${password}  (change it after signing in)`);
      if (!platformAdminUsernames().has(username)) {
        console.log(
          `\nAdd it to the server environment, then restart:\n  PLATFORM_ADMINS=${[...platformAdminUsernames(), username].join(",")}`,
        );
      }
      console.log("\nSign in at /login: you will be asked to set up an authenticator app.");
      return;
    }
    case "platform:2fa-reset": {
      const username = positional[0]?.trim().toLowerCase();
      const [target] = await db
        .select({ id: user.id, role: user.role })
        .from(user)
        .where(eq(user.username, username ?? ""));
      if (!target) throw new Error("User not found");
      await db.delete(twoFactor).where(eq(twoFactor.userId, target.id));
      await db.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, target.id));
      await db.delete(session).where(and(eq(session.userId, target.id)));
      console.log(
        `Two-factor authentication removed for "${username}". Set it up again at the next sign-in.`,
      );
      return;
    }
    default:
      console.log(
        "Commands: keys:generate, license:create, license:list, license:revoke, license:reset, store:list, store:subscription, platform:admin, platform:2fa-reset",
      );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
