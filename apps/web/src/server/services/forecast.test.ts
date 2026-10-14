import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { purchaseCreateInput, saleCreateInput, supplierInput } from "@/lib/validators";
import { makeDb, makeProduct, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { products, stockMovements } from "../db/schema";
import { forecastProduct, setThresholds, stockAlerts, stockForecast } from "./forecast";
import { createPurchase } from "./purchases";
import { createSale } from "./sales";
import { createSupplier } from "./suppliers";

let db: Database;
let ctx: Ctx;
const opts = { alertDays: 7, coverDays: 14 };

beforeEach(async () => {
  db = await makeDb();
  ({ ctx } = await makeStore(db));
});

describe("forecastProduct", () => {
  it("turns sales speed into days left, a status and suggestions", () => {
    // 56 sold in 28 days = 2 a day; 10 in stock lasts 5 days (< 7).
    expect(forecastProduct({ stock: 10, lowStockThreshold: 3 }, 56, 28, opts)).toEqual({
      dailyRate: 2,
      daysLeft: 5,
      status: "soon",
      suggestedQuantity: 18, // 2 × 14 − 10
      suggestedThreshold: 14, // 2 × 7
    });
    // Plenty left: nothing to order.
    expect(forecastProduct({ stock: 100, lowStockThreshold: 3 }, 28, 28, opts)).toMatchObject({
      daysLeft: 100,
      status: "ok",
      suggestedQuantity: 0,
    });
  });

  it("falls back to the alert level for products that don't sell", () => {
    expect(forecastProduct({ stock: 2, lowStockThreshold: 5 }, 0, 28, opts)).toEqual({
      dailyRate: 0,
      daysLeft: null,
      status: "low",
      suggestedQuantity: 4, // up to 6, just above the alert level
      suggestedThreshold: null,
    });
    expect(forecastProduct({ stock: -1, lowStockThreshold: 5 }, 0, 28, opts).status).toBe("out");
  });
});

describe("stockForecast", () => {
  it("reads demand from the stock ledger and the supplier from the last purchase", async () => {
    const milk = await makeProduct(db, ctx, {
      name: "Milk",
      stock: 40,
      salePrice: 100,
      costPrice: 60,
    });
    const salt = await makeProduct(db, ctx, {
      name: "Salt",
      stock: 50,
      salePrice: 50,
      costPrice: 20,
    });
    const supplier = await createSupplier(db, ctx, supplierInput.parse({ name: "Laiterie" }));
    await createPurchase(
      db,
      ctx,
      purchaseCreateInput.parse({
        supplierId: supplier.id,
        items: [{ productId: milk.id, quantity: 10, unitCost: 70 }],
        amountPaid: 700,
      }),
    );
    // Products are new: their age counts as at least 7 days of history.
    await createSale(
      db,
      ctx,
      saleCreateInput.parse({ items: [{ productId: milk.id, quantity: 42 }] }),
      { deviceCode: "T" },
    );

    const { items } = await stockForecast(db, ctx);
    const m = items.find((i) => i.id === milk.id)!;
    expect(m).toMatchObject({
      stock: 8,
      dailyRate: 6, // 42 sold over 7 days
      daysLeft: 1,
      status: "soon",
      suggestedQuantity: 76, // 6 × 14 − 8
      suggestedThreshold: 42,
      supplierId: supplier.id,
      supplierName: "Laiterie",
      lastCost: 70,
    });
    expect(items.find((i) => i.id === salt.id)).toMatchObject({ status: "ok", daysLeft: null });

    // Old sales fall out of the window.
    await db
      .update(stockMovements)
      .set({ createdAt: new Date(Date.now() - 40 * 86_400_000) })
      .where(eq(stockMovements.reason, "sale"));
    const later = await stockForecast(db, ctx);
    expect(later.items.find((i) => i.id === milk.id)).toMatchObject({ dailyRate: 0, status: "ok" });
  });

  it("lists alerts first and applies suggested alert levels", async () => {
    const a = await makeProduct(db, ctx, { name: "A", stock: 0 });
    await makeProduct(db, ctx, { name: "B", stock: 100 });
    const c = await makeProduct(db, ctx, { name: "C", stock: 2 });
    const alerts = await stockAlerts(db, ctx);
    expect(alerts.summary).toEqual({ out: 1, low: 1, soon: 0, total: 2 });
    expect(alerts.items.map((i) => i.id)).toEqual([a.id, c.id]);

    await setThresholds(db, ctx, [{ productId: c.id, threshold: 1 }]);
    const [row] = await db.select().from(products).where(eq(products.id, c.id));
    expect(row.lowStockThreshold).toBe(1);
    expect((await stockAlerts(db, ctx)).summary.total).toBe(1);
  });
});
