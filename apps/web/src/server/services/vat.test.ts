import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { allocate, includedTax, taxBreakdown } from "@/lib/tax";
import {
  productCreateInput,
  reportQuery,
  returnCreateInput,
  saleCreateInput,
} from "@/lib/validators";
import { makeDb, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { categories, returnItems, stores } from "../db/schema";
import { createProduct } from "./products";
import { salesReport } from "./reports";
import { createReturn } from "./returns";
import { createSale } from "./sales";
import { createStore } from "./stores";

let db: Database;
let ctx: Ctx;

beforeEach(async () => {
  db = await makeDb();
  ({ ctx } = await makeStore(db));
});

describe("tax helpers", () => {
  it("extracts included VAT and splits amounts exactly", () => {
    expect(includedTax(11900, 19)).toBe(1900);
    expect(includedTax(10900, 9)).toBe(900);
    expect(includedTax(5000, 0)).toBe(0);
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
    expect(
      taxBreakdown(
        [
          { taxRate: 19, lineTotal: 11900, taxAmount: 1900 },
          { taxRate: 0, lineTotal: 500, taxAmount: 0 },
        ],
        0,
      ),
    ).toEqual([{ rate: 19, base: 10000, tax: 1900, total: 11900 }]);
  });
});

describe("VAT on sales", () => {
  const product = (name: string, salePrice: number, taxRate?: number) =>
    createProduct(
      db,
      ctx,
      productCreateInput.parse({
        name,
        barcode: name,
        costPrice: 5000,
        salePrice,
        stock: 10,
        taxRate,
      }),
    );

  it("records nothing while the store doesn't charge VAT", async () => {
    const p = await product("A", 11900);
    const sale = await createSale(
      db,
      ctx,
      saleCreateInput.parse({ items: [{ productId: p.id, quantity: 1 }] }),
      { deviceCode: "T" },
    );
    expect(sale.taxTotal).toBe(0);
    expect(sale.items[0]).toMatchObject({ taxRate: 0, taxAmount: 0 });
  });

  it("extracts VAT per rate after discounts, refunds it and reports it", async () => {
    await db
      .update(stores)
      .set({ taxEnabled: true, taxRate: 19 })
      .where(eq(stores.id, ctx.storeId));
    const a = await product("A", 11900); // store rate 19 %
    const b = await product("B", 10900, 9); // reduced rate
    const sale = await createSale(
      db,
      ctx,
      saleCreateInput.parse({
        items: [
          { productId: a.id, quantity: 2 },
          { productId: b.id, quantity: 1 },
        ],
        discount: 3470, // 10 %, spread 2380 / 1090 over the lines
      }),
      { deviceCode: "T" },
    );
    expect(sale.total).toBe(31230);
    const lineA = sale.items.find((i) => i.productId === a.id)!;
    const lineB = sale.items.find((i) => i.productId === b.id)!;
    expect(lineA).toMatchObject({ taxRate: 19, taxAmount: 3420 }); // 21420 × 19/119
    expect(lineB).toMatchObject({ taxRate: 9, taxAmount: 810 }); // 9810 × 9/109
    expect(sale.taxTotal).toBe(4230);

    await createReturn(
      db,
      ctx,
      sale.id,
      returnCreateInput.parse({ items: [{ saleItemId: lineA.id, quantity: 1 }] }),
    );
    const [ret] = await db.select().from(returnItems);
    expect(ret.taxAmount).toBe(includedTax(ret.refundAmount, 19));

    const day = 86_400_000;
    const report = await salesReport(
      db,
      ctx,
      reportQuery.parse({
        from: new Date(Date.now() - day).toISOString(),
        to: new Date(Date.now() + day).toISOString(),
      }),
    );
    const revenue = 31230 - ret.refundAmount;
    const tax = 4230 - ret.taxAmount;
    expect(report.summary).toMatchObject({ revenue, tax, cost: 10000 });
    expect(report.summary.profit).toBe(revenue - tax - 10000);
  });
});

describe("shop types", () => {
  it("creates starter categories in the owner's language", async () => {
    const store = await createStore(db, {
      name: "Boutique",
      currency: "DZD",
      shopType: "fashion",
      locale: "ar",
    });
    const rows = await db.select().from(categories).where(eq(categories.storeId, store.id));
    expect(store.shopType).toBe("fashion");
    expect(rows.map((r) => r.name)).toContain("أحذية");
    // General shops start empty.
    const general = await db.select().from(categories).where(eq(categories.storeId, ctx.storeId));
    expect(general).toHaveLength(0);
  });
});
