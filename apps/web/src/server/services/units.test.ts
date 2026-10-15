import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ean13CheckDigit, parseScaleBarcode } from "@/lib/scale-barcode";
import {
  productCreateInput,
  purchaseCreateInput,
  returnCreateInput,
  saleCreateInput,
  saleListQuery,
} from "@/lib/validators";
import { makeDb, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { products, stores } from "../db/schema";
import { createProduct, findByBarcode } from "./products";
import { createPurchase } from "./purchases";
import { createReturn } from "./returns";
import { createSale, listSales } from "./sales";

let db: Database;
let ctx: Ctx;
const opts = { deviceCode: "T" };

beforeEach(async () => {
  db = await makeDb();
  ({ ctx } = await makeStore(db));
});

const tomatoes = () =>
  createProduct(
    db,
    ctx,
    productCreateInput.parse({
      name: "Tomates",
      barcode: "TOM1",
      costPrice: 8000, // 80 DA / kg
      salePrice: 12000, // 120 DA / kg
      stock: 10,
      unit: "kg",
      scaleCode: "00042",
    }),
  );

const stockOf = async (id: string) =>
  (await db.select({ s: products.stock }).from(products).where(eq(products.id, id)))[0].s;

/** Builds a valid scale barcode: 2 · 1 · code · value · check. */
const scaleCode = (code: string, value: number) => {
  const first12 = `21${code.padStart(5, "0")}${String(value).padStart(5, "0")}`;
  return first12 + ean13CheckDigit(first12);
};

describe("measured products", () => {
  it("sells, buys and returns fractions of a kilo without drift", async () => {
    const p = await tomatoes();
    expect(p).toMatchObject({ unit: "kg", scaleCode: "42", stock: 10 });

    const sale = await createSale(
      db,
      ctx,
      saleCreateInput.parse({ items: [{ productId: p.id, quantity: 0.75 }] }),
      opts,
    );
    expect(sale.total).toBe(9000); // 0.75 × 120 DA
    expect(sale.totalCost).toBe(6000);
    // Many small sales: 10 − 0.75 − 3 × 0.1 must stay exact.
    for (let i = 0; i < 3; i++) {
      await createSale(
        db,
        ctx,
        saleCreateInput.parse({ items: [{ productId: p.id, quantity: 0.1 }] }),
        opts,
      );
    }
    expect(await stockOf(p.id)).toBe(8.95);

    await createReturn(
      db,
      ctx,
      sale.id,
      returnCreateInput.parse({ items: [{ saleItemId: sale.items[0].id, quantity: 0.25 }] }),
    );
    expect(await stockOf(p.id)).toBe(9.2);
    // In the sales list a weighed line counts as one item, returned or not.
    const listed = (await listSales(db, ctx, saleListQuery.parse({}))).rows.find(
      (r) => r.id === sale.id,
    );
    expect(listed).toMatchObject({ itemCount: 1, returnedCount: 1 });

    await createPurchase(
      db,
      ctx,
      purchaseCreateInput.parse({
        items: [{ productId: p.id, quantity: 2.5, unitCost: 7000 }],
        amountPaid: 17500,
      }),
    );
    expect(await stockOf(p.id)).toBe(11.7);
  });

  it("keeps pieces whole", async () => {
    const p = await createProduct(
      db,
      ctx,
      productCreateInput.parse({
        name: "Eau",
        barcode: "EAU1",
        costPrice: 20,
        salePrice: 30,
        stock: 5,
      }),
    );
    await expect(
      createSale(
        db,
        ctx,
        saleCreateInput.parse({ items: [{ productId: p.id, quantity: 1.5 }] }),
        opts,
      ),
    ).rejects.toMatchObject({ code: "QUANTITY_WHOLE" });
    expect(() =>
      saleCreateInput.parse({ items: [{ productId: p.id, quantity: 0.0001 }] }),
    ).toThrow();
  });
});

describe("scale barcodes", () => {
  it("parses EAN-13 scale labels and checks the check digit", () => {
    const code = scaleCode("42", 750);
    expect(parseScaleBarcode(code)).toEqual({ code: "42", value: 750 });
    expect(parseScaleBarcode(code.slice(0, 12) + ((Number(code[12]) + 1) % 10))).toBeNull();
    expect(parseScaleBarcode("6130000000014")).toBeNull();
  });

  it("finds the product and the quantity from a weight or a price label", async () => {
    const p = await tomatoes();
    // Off by default: scale labels are unknown barcodes.
    await expect(findByBarcode(db, ctx, scaleCode("42", 750))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await db.update(stores).set({ scaleBarcodes: "weight" }).where(eq(stores.id, ctx.storeId));
    expect(await findByBarcode(db, ctx, scaleCode("42", 750))).toMatchObject({
      id: p.id,
      scaleQuantity: 0.75,
    });
    // A normal barcode still works and has no scale quantity.
    expect(await findByBarcode(db, ctx, "TOM1")).toMatchObject({ id: p.id, scaleQuantity: null });

    // Price labels: 90 DA of tomatoes at 120 DA / kg = 0.75 kg.
    await db.update(stores).set({ scaleBarcodes: "price" }).where(eq(stores.id, ctx.storeId));
    expect(await findByBarcode(db, ctx, scaleCode("42", 90))).toMatchObject({
      scaleQuantity: 0.75,
    });
    await expect(findByBarcode(db, ctx, scaleCode("43", 90))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
