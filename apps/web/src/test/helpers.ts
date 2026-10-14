import { createDb, type Database } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import type { Ctx } from "@/server/context";
import { createStore } from "@/server/services/stores";
import { createProduct } from "@/server/services/products";
import { productCreateInput } from "@/lib/validators";

let counter = 0;

/** Fresh in-memory database with the full schema. */
export async function makeDb(): Promise<Database> {
  const db = createDb(":memory:");
  await runMigrations(db);
  return db;
}

export async function makeStore(db: Database, name = "Shop") {
  const store = await createStore(db, { name, currency: "DZD" });
  const ctx: Ctx = { storeId: store.id, userId: `user-${++counter}`, userName: "Cashier" };
  return { store, ctx };
}

export async function makeProduct(
  db: Database,
  ctx: Ctx,
  opts: { stock?: number; salePrice?: number; costPrice?: number; name?: string } = {},
) {
  return createProduct(
    db,
    ctx,
    productCreateInput.parse({
      name: opts.name ?? `Product ${++counter}`,
      barcode: `BC${Date.now()}${++counter}`,
      costPrice: opts.costPrice ?? 600,
      salePrice: opts.salePrice ?? 1000,
      stock: opts.stock ?? 10,
    }),
  );
}
