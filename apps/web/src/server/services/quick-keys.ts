import { eq } from "drizzle-orm";
import { parseQuickKeys, type QuickPage } from "@/lib/quick-keys";
import type { Ctx } from "../context";
import type { Executor } from "../db/client";
import { stores } from "../db/schema";
import { AppError } from "../errors";
import { listProducts } from "./products";

/** The till's quick buttons, with the products they add (deleted ones are left out). */
export async function getQuickKeys(db: Executor, ctx: Ctx) {
  const [store] = await db
    .select({ quickKeys: stores.quickKeys })
    .from(stores)
    .where(eq(stores.id, ctx.storeId));
  if (!store) throw new AppError("NOT_FOUND");
  const pages = parseQuickKeys(store.quickKeys);
  const ids = [...new Set(pages.flatMap((p) => p.keys.map((k) => k.productId)))];
  // Full product rows (price, stock, unit...); deleted products are left out.
  const rows = ids.length
    ? (
        await listProducts(db, ctx, {
          ids,
          includeInactive: true,
          stock: "all",
          sort: "name",
          page: 1,
          pageSize: 500,
        })
      ).rows
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    pages: pages.map((p) => ({
      name: p.name,
      keys: p.keys.flatMap((k) => {
        const product = byId.get(k.productId);
        return product ? [{ ...k, product }] : [];
      }),
    })),
  };
}

export async function saveQuickKeys(db: Executor, ctx: Ctx, pages: QuickPage[]) {
  await db
    .update(stores)
    .set({ quickKeys: JSON.stringify(pages) })
    .where(eq(stores.id, ctx.storeId));
  return getQuickKeys(db, ctx);
}
