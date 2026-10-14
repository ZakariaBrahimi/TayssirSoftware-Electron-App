import { count, eq, isNotNull } from "drizzle-orm";
import type { StoreSettingsInput } from "@/lib/validators";
import type { Executor } from "../db/client";
import { categories, stores, user } from "../db/schema";
import { AppError } from "../errors";
import type { ScaleBarcodeMode } from "@/lib/validators";
import { isShopType, type ShopType, starterCategories } from "@/lib/shop-types";

export type Store = typeof stores.$inferSelect;

export const TRIAL_DAYS = 14;

export async function getStore(db: Executor, storeId: string): Promise<Store> {
  const [row] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

export async function createStore(
  db: Executor,
  input: { name: string; currency: string; id?: string; shopType?: ShopType; locale?: string },
  trialDays = TRIAL_DAYS,
) {
  const { locale, ...values } = input;
  const [row] = await db
    .insert(stores)
    .values({
      ...values,
      trialEndsAt: new Date(Date.now() + trialDays * 86_400_000),
    })
    .returning();
  // Starter categories for the kind of shop, in the owner's language.
  const names = starterCategories(values.shopType ?? "general", locale ?? "fr");
  if (names.length) {
    await db.insert(categories).values(names.map((name) => ({ storeId: row.id, name })));
  }
  return row;
}

export async function updateStore(db: Executor, storeId: string, input: StoreSettingsInput) {
  const [row] = await db.update(stores).set(input).where(eq(stores.id, storeId)).returning();
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

/** Local mode: true until the first store and administrator exist. */
export async function needsSetup(db: Executor) {
  const [{ users }] = await db.select({ users: count() }).from(user).where(isNotNull(user.storeId));
  return users === 0;
}

/** Local mode: the single store of this installation. */
export async function getLocalStore(db: Executor): Promise<Store | null> {
  const [row] = await db.select().from(stores).limit(1);
  return row ?? null;
}

/** Public view of a store (no subscription internals). */
export function publicStore(s: Store) {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    phone: s.phone,
    currency: s.currency,
    receiptFooter: s.receiptFooter,
    requireShift: s.requireShift,
    stockAlertDays: s.stockAlertDays,
    reorderCoverDays: s.reorderCoverDays,
    scaleBarcodes: s.scaleBarcodes as ScaleBarcodeMode,
    shopType: (isShopType(s.shopType) ? s.shopType : "general") as ShopType,
    taxEnabled: s.taxEnabled,
    taxRate: s.taxRate,
    taxId: s.taxId,
  };
}
