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
 */
import { desc, eq, or } from "drizzle-orm";
import { createDb } from "../db/client";
import {
  licenseActivations,
  licenses,
  stores,
  SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
} from "../db/schema";
import { createLicense } from "../licensing/server";
import { generateSigningKeys } from "../licensing/token";

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
      const { key, license } = await createLicense(db, {
        plan: flags.get("plan") ?? "standard",
        maxDevices: Number(flags.get("devices") ?? 1),
        expiresAt: days ? new Date(Date.now() + Number(days) * 86_400_000) : null,
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
      await db.update(licenses).set({ revokedAt: new Date() }).where(eq(licenses.id, l.id));
      console.log(
        `Revoked ${l.id}. Already activated installs keep working until their token expires.`,
      );
      return;
    }
    case "license:reset": {
      const l = await findLicense(positional[0]);
      await db.delete(licenseActivations).where(eq(licenseActivations.licenseId, l.id));
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
      const [row] = await db
        .update(stores)
        .set({
          subscriptionStatus: status,
          ...(flags.has("plan") ? { plan: flags.get("plan")! } : {}),
          ...(until ? { currentPeriodEnd: new Date(`${until}T23:59:59Z`) } : {}),
        })
        .where(eq(stores.id, positional[0]))
        .returning();
      if (!row) throw new Error("Store not found");
      console.log(
        `${row.name}: ${row.subscriptionStatus} (${row.plan}) until ${row.currentPeriodEnd?.toISOString() ?? "—"}`,
      );
      return;
    }
    default:
      console.log(
        "Commands: keys:generate, license:create, license:list, license:revoke, license:reset, store:list, store:subscription",
      );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
