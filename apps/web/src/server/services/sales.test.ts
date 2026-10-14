import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { customerInput, saleCreateInput } from "@/lib/validators";
import { makeDb, makeProduct, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { products, stockMovements, stores } from "../db/schema";
import { createCustomer, getCustomer } from "./customers";
import { getProduct, listProducts } from "./products";
import { createSale, getSale, listSales, voidSale } from "./sales";

let db: Database;
let ctx: Ctx;
const sale = (input: unknown) => saleCreateInput.parse(input);
const opts = { deviceCode: "ABC" };

async function stockOf(id: string) {
  const [row] = await db.select({ stock: products.stock }).from(products).where(eq(products.id, id));
  return row.stock;
}

beforeEach(async () => {
  db = await makeDb();
  ({ ctx } = await makeStore(db));
});

describe("createSale", () => {
  it("prices from the catalog, decrements stock and records movements", async () => {
    const p = await makeProduct(db, ctx, { stock: 10, salePrice: 1000, costPrice: 600 });
    const result = await createSale(
      db,
      ctx,
      sale({ items: [{ productId: p.id, quantity: 3, discount: 100 }], discount: 400, amountPaid: 5000 }),
      opts,
    );
    expect(result.subtotal).toBe(2900);
    expect(result.total).toBe(2500);
    expect(result.totalCost).toBe(1800);
    expect(result.changeDue).toBe(2500);
    expect(result.balanceDue).toBe(0);
    expect(result.number).toBe("ABC-1");
    expect(await stockOf(p.id)).toBe(7);
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.productId, p.id));
    expect(moves.map((m) => m.reason).sort()).toEqual(["initial", "sale"]);
  });

  it("numbers receipts per device", async () => {
    const p = await makeProduct(db, ctx);
    const a = await createSale(db, ctx, sale({ items: [{ productId: p.id, quantity: 1 }] }), opts);
    const b = await createSale(db, ctx, sale({ items: [{ productId: p.id, quantity: 1 }] }), opts);
    const c = await createSale(db, ctx, sale({ items: [{ productId: p.id, quantity: 1 }] }), { deviceCode: "W" });
    expect([a.number, b.number, c.number]).toEqual(["ABC-1", "ABC-2", "W-1"]);
    const found = await listSales(db, ctx, { q: "ABC-2", page: 1, pageSize: 20 });
    expect(found.rows.map((r) => r.id)).toEqual([b.id]);
  });

  it("merges duplicate lines", async () => {
    const p = await makeProduct(db, ctx);
    const result = await createSale(
      db,
      ctx,
      sale({ items: [{ productId: p.id, quantity: 1 }, { productId: p.id, quantity: 2 }] }),
      opts,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(3);
  });

  it("refuses to oversell and rolls back the whole sale", async () => {
    const a = await makeProduct(db, ctx, { stock: 5 });
    const b = await makeProduct(db, ctx, { stock: 1 });
    await expect(
      createSale(
        db,
        ctx,
        sale({ items: [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 2 }] }),
        opts,
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await stockOf(a.id)).toBe(5);
    expect(await stockOf(b.id)).toBe(1);
  });

  it("rejects underpayment without a customer and excessive discounts", async () => {
    const p = await makeProduct(db, ctx, { salePrice: 1000 });
    await expect(
      createSale(db, ctx, sale({ items: [{ productId: p.id, quantity: 1 }], amountPaid: 500 }), opts),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_PAYMENT" });
    await expect(
      createSale(db, ctx, sale({ items: [{ productId: p.id, quantity: 1 }], paymentMethod: "credit" }), opts),
    ).rejects.toMatchObject({ code: "CUSTOMER_REQUIRED" });
    await expect(
      createSale(db, ctx, sale({ items: [{ productId: p.id, quantity: 1 }], discount: 2000 }), opts),
    ).rejects.toMatchObject({ code: "INVALID_DISCOUNT" });
  });

  it("puts unpaid amounts on the customer's account within the credit limit", async () => {
    const p = await makeProduct(db, ctx, { salePrice: 1000, stock: 50 });
    const customer = await createCustomer(db, ctx, customerInput.parse({ name: "Karim", creditLimit: 2500 }));

    const credit = await createSale(
      db,
      ctx,
      sale({ items: [{ productId: p.id, quantity: 2 }], customerId: customer.id, paymentMethod: "credit" }),
      opts,
    );
    expect(credit.balanceDue).toBe(2000);
    expect(credit.customerName).toBe("Karim");

    // Partial cash payment: 300 paid, 700 on account → 2700 > 2500 limit.
    await expect(
      createSale(
        db,
        ctx,
        sale({ items: [{ productId: p.id, quantity: 1 }], customerId: customer.id, amountPaid: 300 }),
        opts,
      ),
    ).rejects.toMatchObject({ code: "CREDIT_LIMIT_EXCEEDED" });

    const partial = await createSale(
      db,
      ctx,
      sale({ items: [{ productId: p.id, quantity: 1 }], customerId: customer.id, amountPaid: 600 }),
      opts,
    );
    expect(partial.balanceDue).toBe(400);
    expect((await getCustomer(db, ctx, customer.id)).balance).toBe(2400);
  });

  it("requires an open shift when the store says so", async () => {
    await db.update(stores).set({ requireShift: true }).where(eq(stores.id, ctx.storeId));
    const p = await makeProduct(db, ctx);
    await expect(
      createSale(db, ctx, sale({ items: [{ productId: p.id, quantity: 1 }] }), opts),
    ).rejects.toMatchObject({ code: "SHIFT_REQUIRED" });
  });
});

describe("voidSale", () => {
  it("restores stock once and clears the customer's debt", async () => {
    const p = await makeProduct(db, ctx, { stock: 5 });
    const customer = await createCustomer(db, ctx, customerInput.parse({ name: "Amina" }));
    const s = await createSale(
      db,
      ctx,
      sale({ items: [{ productId: p.id, quantity: 2 }], customerId: customer.id, paymentMethod: "credit" }),
      opts,
    );
    expect(await stockOf(p.id)).toBe(3);
    expect((await getCustomer(db, ctx, customer.id)).balance).toBe(2000);

    const voided = await voidSale(db, ctx, s.id);
    expect(voided.status).toBe("voided");
    expect(await stockOf(p.id)).toBe(5);
    expect((await getCustomer(db, ctx, customer.id)).balance).toBe(0);
    await expect(voidSale(db, ctx, s.id)).rejects.toMatchObject({ code: "SALE_ALREADY_VOIDED" });
    expect(await stockOf(p.id)).toBe(5);
  });
});

describe("store isolation", () => {
  it("never exposes or sells another store's products", async () => {
    const p = await makeProduct(db, ctx);
    const { ctx: other } = await makeStore(db, "Other shop");
    await expect(getProduct(db, other, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listProducts(db, other, { stock: "all", sort: "name", page: 1, pageSize: 20 })).total).toBe(0);
    await expect(
      createSale(db, other, sale({ items: [{ productId: p.id, quantity: 1 }] }), opts),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const s = await createSale(db, ctx, sale({ items: [{ productId: p.id, quantity: 1 }] }), opts);
    await expect(getSale(db, other, s.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
