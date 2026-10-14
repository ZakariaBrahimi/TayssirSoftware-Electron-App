import { count, eq } from "drizzle-orm";
import type { SettingsInput } from "@/lib/validators";
import type { Executor } from "../db/client";
import { storeSettings, user } from "../db/schema";

const SETTINGS_ID = 1;

export async function getSettings(db: Executor): Promise<typeof storeSettings.$inferSelect> {
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, SETTINGS_ID));
  if (row) return row;
  const [created] = await db
    .insert(storeSettings)
    .values({ id: SETTINGS_ID })
    .onConflictDoNothing()
    .returning();
  return created ?? (await getSettings(db));
}

export type StoreSettings = typeof storeSettings.$inferSelect;

export async function updateSettings(db: Executor, input: SettingsInput) {
  const [row] = await db
    .insert(storeSettings)
    .values({ id: SETTINGS_ID, ...input })
    .onConflictDoUpdate({ target: storeSettings.id, set: input })
    .returning();
  return row;
}

export async function needsSetup(db: Executor) {
  const [{ users }] = await db.select({ users: count() }).from(user);
  return users === 0;
}
