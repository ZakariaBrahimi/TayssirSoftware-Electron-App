import { and, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import { isMeasured, lineAmount, round3 } from "@/lib/quantity";
import type { stockCountInput } from "@/lib/validators";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { products } from "../db/schema";
import { AppError } from "../errors";
import { moveStock } from "./stock";

/**
 * Applies a stock count: each counted product gets an adjustment of the
 * difference, so its stock becomes what was counted. Returns what changed.
 */
export async function applyStockCount(
  db: Database,
  ctx: Ctx,
  input: z.output<typeof stockCountInput>,
) {
  // The last count of a product wins (it may be scanned twice).
  const counted = new Map(input.items.map((i) => [i.productId, i.counted]));
  const note = input.note || "Stock count";

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: products.id,
        name: products.name,
        stock: products.stock,
        unit: products.unit,
        kind: products.kind,
        costPrice: products.costPrice,
      })
      .from(products)
      .where(
        and(
          inArray(products.id, [...counted.keys()]),
          eq(products.storeId, ctx.storeId),
          isNull(products.deletedAt),
        ),
      );
    if (rows.length !== counted.size) throw new AppError("NOT_FOUND");

    const lines = [];
    for (const p of rows) {
      const value = counted.get(p.id)!;
      if (p.kind === "service") throw new AppError("NOT_STOCKED", undefined, { name: p.name });
      if (!isMeasured(p.unit) && !Number.isInteger(value)) {
        throw new AppError("QUANTITY_WHOLE", undefined, { name: p.name });
      }
      const change = round3(value - p.stock);
      if (change !== 0) {
        await moveStock(tx, ctx, { productId: p.id, change, reason: "adjustment", note });
      }
      lines.push({ productId: p.id, name: p.name, before: p.stock, counted: value, change });
    }
    const changed = lines.filter((l) => l.change !== 0);
    // Value of the differences at cost (negative: missing goods).
    const cost = new Map(rows.map((p) => [p.id, p.costPrice]));
    const value = changed.reduce(
      (sum, l) =>
        sum + Math.sign(l.change) * lineAmount(cost.get(l.productId)!, Math.abs(l.change)),
      0,
    );
    return { counted: lines.length, adjusted: changed.length, value, lines: changed };
  });
}
