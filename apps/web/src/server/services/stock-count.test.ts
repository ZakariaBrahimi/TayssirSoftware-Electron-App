import { beforeEach, describe, expect, it } from "vitest";
import { productCreateInput, stockCountInput } from "@/lib/validators";
import { makeDb, makeProduct, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { createProduct, getProduct, listStockMovements } from "./products";
import { applyStockCount } from "./stock-count";

let db: Database;
let ctx: Ctx;

beforeEach(async () => {
  db = await makeDb();
  ({ ctx } = await makeStore(db));
});

describe("stock count", () => {
  it("sets the stock to what was counted and reports the differences", async () => {
    const milk = await makeProduct(db, ctx, { stock: 10, costPrice: 600 });
    const salt = await makeProduct(db, ctx, { stock: 5, costPrice: 200 });
    const cheese = await createProduct(
      db,
      ctx,
      productCreateInput.parse({
        name: "Cheese",
        barcode: "CH",
        unit: "kg",
        costPrice: 1000,
        salePrice: 1500,
        stock: 2,
      }),
    );
    const result = await applyStockCount(
      db,
      ctx,
      stockCountInput.parse({
        items: [
          { productId: milk.id, counted: 7 }, // 3 missing
          { productId: salt.id, counted: 5 }, // right
          { productId: cheese.id, counted: 2.25 }, // 0.25 kg more
          { productId: milk.id, counted: 8 }, // counted again: the last one wins
        ],
      }),
    );
    expect(result).toMatchObject({ counted: 3, adjusted: 2, value: -1200 + 250 });
    expect((await getProduct(db, ctx, milk.id)).stock).toBe(8);
    expect((await getProduct(db, ctx, cheese.id)).stock).toBe(2.25);
    const [move] = await listStockMovements(db, ctx, milk.id);
    expect(move).toMatchObject({ change: -2, reason: "adjustment", note: "Stock count" });

    await expect(
      applyStockCount(
        db,
        ctx,
        stockCountInput.parse({ items: [{ productId: salt.id, counted: 1.5 }] }),
      ),
    ).rejects.toMatchObject({ code: "QUANTITY_WHOLE" });
  });
});
