import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Ctx } from "../context";
import type { Executor } from "../db/client";
import { products, stockMovements, type StockMovementReason } from "../db/schema";
import { col } from "../db/sql";

/**
 * Applies a stock change: appends to the movement ledger and updates the
 * cached `products.stock` without touching `updatedAt` (a stock change is
 * not an edit of the product, so it must not win sync conflicts).
 *
 * With `requireAvailable`, the update only happens if enough stock is left
 * (guards against concurrent sales overselling); returns null otherwise.
 *
 * Services (repairs, printing...) have no stock: nothing is recorded and
 * the move always succeeds.
 */
export async function moveStock(
  db: Executor,
  ctx: Ctx,
  input: {
    productId: string;
    change: number;
    reason: StockMovementReason;
    refId?: string | null;
    note?: string | null;
    requireAvailable?: boolean;
  },
): Promise<{ stock: number } | null> {
  const where = [
    eq(products.id, input.productId),
    eq(products.storeId, ctx.storeId),
    ne(products.kind, "service"),
  ];
  if (input.requireAvailable) {
    // Rounded: measured quantities (0.75 kg) must not drift (0.1 + 0.2).
    where.push(sql`round(${products.stock} + ${input.change}, 3) >= 0`);
  }
  const [row] = await db
    .update(products)
    .set({
      stock: sql`round(${products.stock} + ${input.change}, 3)`,
      updatedAt: sql`${products.updatedAt}`,
    })
    .where(and(...where))
    .returning({ stock: products.stock });
  if (!row) {
    const [service] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.id, input.productId),
          eq(products.storeId, ctx.storeId),
          eq(products.kind, "service"),
        ),
      );
    return service ? { stock: 0 } : null;
  }

  await db.insert(stockMovements).values({
    storeId: ctx.storeId,
    productId: input.productId,
    change: input.change,
    reason: input.reason,
    refId: input.refId ?? null,
    note: input.note ?? null,
    userId: ctx.userId,
    userName: ctx.userName,
  });
  return row;
}

/** Rebuilds the stock cache from the movement ledger (after a sync). */
export async function recomputeStock(db: Executor, productIds: string[]) {
  if (productIds.length === 0) return;
  for (let i = 0; i < productIds.length; i += 500) {
    const chunk = productIds.slice(i, i + 500);
    await db
      .update(products)
      .set({
        stock: sql`round((select coalesce(sum(${stockMovements.change}), 0) from ${stockMovements} where ${stockMovements.productId} = ${col("products", "id")}), 3)`,
        updatedAt: sql`${products.updatedAt}`,
      })
      .where(inArray(products.id, chunk));
  }
}
