import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  productCreateInput,
  purchaseCreateInput,
  returnCreateInput,
  saleCreateInput,
} from "@/lib/validators";
import { makeDb, makeProduct, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { stockMovements } from "../db/schema";
import { stockForecast } from "./forecast";
import { adjustStock, createProduct, listProducts } from "./products";
import { createPurchase } from "./purchases";
import { createReturn } from "./returns";
import { createSale, voidSale } from "./sales";

let db: Database;
let ctx: Ctx;
const opts = { deviceCode: "T" };

beforeEach(async () => {
  db = await makeDb();
  ({ ctx } = await makeStore(db));
});

const service = (fields: Record<string, unknown> = {}) =>
  createProduct(
    db,
    ctx,
    productCreateInput.parse({
      name: "Photocopy A4",
      barcode: "COPY",
      kind: "service",
      costPrice: 200,
      salePrice: 1000,
      stock: 50, // ignored
      ...fields,
    }),
  );

describe("services", () => {
  it("sell, void and return without any stock", async () => {
    const copy = await service();
    expect(copy).toMatchObject({ kind: "service", stock: 0 });

    const sale = await createSale(
      db,
      ctx,
      saleCreateInput.parse({ items: [{ productId: copy.id, quantity: 30 }] }),
      opts,
    );
    expect(sale.total).toBe(30_000);
    await createReturn(
      db,
      ctx,
      sale.id,
      returnCreateInput.parse({ items: [{ saleItemId: sale.items[0].id, quantity: 5 }] }),
    );
    const other = await createSale(
      db,
      ctx,
      saleCreateInput.parse({ items: [{ productId: copy.id, quantity: 1 }] }),
      opts,
    );
    await voidSale(db, ctx, other.id);

    const moves = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.productId, copy.id));
    expect(moves).toHaveLength(0);
  });

  it("can't be bought or have its stock adjusted, and stays out of stock alerts", async () => {
    const copy = await service();
    await expect(adjustStock(db, ctx, copy.id, { change: 5 })).rejects.toMatchObject({
      code: "NOT_STOCKED",
    });
    await expect(
      createPurchase(
        db,
        ctx,
        purchaseCreateInput.parse({
          items: [{ productId: copy.id, quantity: 1, unitCost: 100 }],
          amountPaid: 100,
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_STOCKED" });

    await makeProduct(db, ctx, { name: "Paper", stock: 0 });
    const low = await listProducts(db, ctx, { stock: "out", sort: "name", page: 1, pageSize: 20 });
    expect(low.rows.map((r) => r.name)).toEqual(["Paper"]);
    const { items } = await stockForecast(db, ctx);
    expect(items.map((i) => i.name)).toEqual(["Paper"]);
  });
});

describe("price typed at the till", () => {
  it("uses the typed price for open-price products only", async () => {
    const repair = await service({
      name: "Screen repair",
      barcode: "REPAIR",
      openPrice: true,
      costPrice: 0,
      salePrice: 0,
    });
    const fixed = await makeProduct(db, ctx, { salePrice: 1000 });
    const sale = await createSale(
      db,
      ctx,
      saleCreateInput.parse({
        items: [
          { productId: repair.id, quantity: 1, unitPrice: 350_000 },
          { productId: repair.id, quantity: 1, unitPrice: 120_000 },
          { productId: fixed.id, quantity: 2, unitPrice: 1 }, // ignored
        ],
      }),
      opts,
    );
    expect(sale.items.map((i) => [i.productName, i.unitPrice, i.lineTotal])).toEqual(
      expect.arrayContaining([
        ["Screen repair", 350_000, 350_000],
        ["Screen repair", 120_000, 120_000],
        [fixed.name, 1000, 2000],
      ]),
    );
    expect(sale.total).toBe(472_000);
  });
});
