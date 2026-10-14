import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  customerInput,
  paymentInput,
  purchaseCreateInput,
  returnCreateInput,
  saleCreateInput,
  saleListQuery,
  supplierInput,
} from "@/lib/validators";
import { makeDb, makeProduct, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { products } from "../db/schema";
import { createCustomer, customerStatement, getCustomer, recordCustomerPayment } from "./customers";
import { createPurchase, supplierStatement, weightedAverageCost } from "./purchases";
import { salesReport } from "./reports";
import { createReturn, lineRefund } from "./returns";
import { createSale, listSales, voidSale } from "./sales";
import { addCashMovement, closeShift, currentShift, openShift } from "./shifts";
import { createSupplier, getSupplier, recordSupplierPayment } from "./suppliers";

let db: Database;
let ctx: Ctx;
const opts = { deviceCode: "T" };
const sale = (input: unknown) => saleCreateInput.parse(input);

async function stockOf(id: string) {
  const [row] = await db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, id));
  return row.stock;
}

beforeEach(async () => {
  db = await makeDb();
  ({ ctx } = await makeStore(db));
});

describe("returns", () => {
  it("spreads the ticket discount so full returns refund exactly what was paid", () => {
    const s = { subtotal: 3000, discount: 1000 };
    const line = { lineTotal: 1000, quantity: 3 }; // pays 1000 − 333 = 667
    const parts = [lineRefund(line, s, 0, 1), lineRefund(line, s, 1, 1), lineRefund(line, s, 2, 1)];
    expect(parts.reduce((a, b) => a + b, 0)).toBe(667);
    expect(lineRefund(line, s, 0, 3)).toBe(667);
  });

  it("refunds part of a sale, restocks and nets the reports", async () => {
    const p = await makeProduct(db, ctx, { stock: 10, salePrice: 1000, costPrice: 600 });
    const s = await createSale(db, ctx, sale({ items: [{ productId: p.id, quantity: 4 }] }), opts);
    const itemId = s.items[0].id;

    const after = await createReturn(
      db,
      ctx,
      s.id,
      returnCreateInput.parse({ items: [{ saleItemId: itemId, quantity: 1 }] }),
    );
    expect(after.refundedAmount).toBe(1000);
    expect(after.items[0].returnedQuantity).toBe(1);
    expect(await stockOf(p.id)).toBe(7);

    // Damaged goods: refunded but not put back in stock.
    await createReturn(
      db,
      ctx,
      s.id,
      returnCreateInput.parse({ items: [{ saleItemId: itemId, quantity: 1 }], restock: false }),
    );
    expect(await stockOf(p.id)).toBe(7);

    await expect(
      createReturn(
        db,
        ctx,
        s.id,
        returnCreateInput.parse({ items: [{ saleItemId: itemId, quantity: 3 }] }),
      ),
    ).rejects.toMatchObject({ code: "RETURN_EXCEEDS_SALE" });
    await expect(voidSale(db, ctx, s.id)).rejects.toMatchObject({ code: "SALE_HAS_RETURNS" });

    const day = new Date();
    const report = await salesReport(db, ctx, {
      from: new Date(day.getTime() - 86_400_000).toISOString(),
      to: new Date(day.getTime() + 86_400_000).toISOString(),
      tzOffset: 0,
    });
    expect(report.summary.grossSales).toBe(4000);
    expect(report.summary.refunds).toBe(2000);
    expect(report.summary.revenue).toBe(2000);
    // Cost: 4×600 sold − 1×600 restocked (the damaged unit stays a cost).
    expect(report.summary.cost).toBe(1800);
    expect(report.topProducts[0].quantity).toBe(2);

    // The sales list keeps the ticket as sold and shows the returns beside it;
    // its profit matches the report (the restocked unit's cost comes back).
    const [row] = (await listSales(db, ctx, saleListQuery.parse({}))).rows;
    expect(row).toMatchObject({
      itemCount: 4,
      returnedCount: 2,
      refunded: 2000,
      restockedCost: 600,
    });
    expect(row.total - row.totalCost - row.refunded + row.restockedCost).toBe(
      report.summary.revenue - report.summary.cost,
    );
  });

  it("can credit the refund to the customer's account", async () => {
    const p = await makeProduct(db, ctx, { salePrice: 1000 });
    const c = await createCustomer(db, ctx, customerInput.parse({ name: "Karim" }));
    const s = await createSale(
      db,
      ctx,
      sale({
        items: [{ productId: p.id, quantity: 2 }],
        customerId: c.id,
        paymentMethod: "credit",
      }),
      opts,
    );
    await createReturn(
      db,
      ctx,
      s.id,
      returnCreateInput.parse({
        items: [{ saleItemId: s.items[0].id, quantity: 1 }],
        refundMethod: "account",
      }),
    );
    expect((await getCustomer(db, ctx, c.id)).balance).toBe(1000);
  });
});

describe("customer accounts", () => {
  it("tracks the balance through sales, payments and a statement", async () => {
    const p = await makeProduct(db, ctx, { salePrice: 1500, stock: 20 });
    const c = await createCustomer(db, ctx, customerInput.parse({ name: "Amina" }));
    await createSale(
      db,
      ctx,
      sale({
        items: [{ productId: p.id, quantity: 2 }],
        customerId: c.id,
        paymentMethod: "credit",
      }),
      opts,
    );
    await recordCustomerPayment(db, ctx, c.id, paymentInput.parse({ amount: 1000 }));
    const { customer, entries } = await customerStatement(db, ctx, c.id);
    expect(customer.balance).toBe(2000);
    expect(entries.map((e) => e.type)).toEqual(["payment", "sale"]);
    expect(entries[0].balance).toBe(2000);
  });
});

describe("purchasing", () => {
  it("averages the cost, adds stock and tracks what is owed to the supplier", () => {
    expect(weightedAverageCost({ stock: 10, costPrice: 100 }, 10, 200)).toBe(150);
    expect(weightedAverageCost({ stock: -3, costPrice: 100 }, 5, 200)).toBe(200);
  });

  it("receives goods on credit and records payments", async () => {
    const p = await makeProduct(db, ctx, { stock: 10, costPrice: 100, salePrice: 300 });
    const supplier = await createSupplier(db, ctx, supplierInput.parse({ name: "Grossiste" }));
    const purchase = await createPurchase(
      db,
      ctx,
      purchaseCreateInput.parse({
        supplierId: supplier.id,
        reference: "BL-42",
        items: [{ productId: p.id, quantity: 10, unitCost: 200 }],
        amountPaid: 500,
      }),
    );
    expect(purchase.total).toBe(2000);
    expect(await stockOf(p.id)).toBe(20);
    const [row] = await db.select().from(products).where(eq(products.id, p.id));
    expect(row.costPrice).toBe(150);
    expect((await getSupplier(db, ctx, supplier.id)).balance).toBe(1500);

    await recordSupplierPayment(db, ctx, supplier.id, paymentInput.parse({ amount: 1500 }));
    const statement = await supplierStatement(db, ctx, supplier.id);
    expect(statement.supplier.balance).toBe(0);
    expect(statement.entries).toHaveLength(2);
  });

  it("needs a supplier for unpaid purchases", async () => {
    const p = await makeProduct(db, ctx);
    await expect(
      createPurchase(
        db,
        ctx,
        purchaseCreateInput.parse({ items: [{ productId: p.id, quantity: 1, unitCost: 100 }] }),
      ),
    ).rejects.toMatchObject({ code: "CUSTOMER_REQUIRED" });
  });
});

describe("cash register shifts", () => {
  it("computes the expected cash in the drawer", async () => {
    const p = await makeProduct(db, ctx, { salePrice: 1000, stock: 50 });
    const c = await createCustomer(db, ctx, customerInput.parse({ name: "Client" }));
    await openShift(db, ctx, { openingCash: 5000 });
    await expect(openShift(db, ctx, { openingCash: 0 })).rejects.toMatchObject({
      code: "SHIFT_ALREADY_OPEN",
    });

    // Cash sale: 2000 total, 5000 handed over, 3000 change → +2000.
    const s1 = await createSale(
      db,
      ctx,
      sale({ items: [{ productId: p.id, quantity: 2 }], amountPaid: 5000 }),
      opts,
    );
    // Card sale: no cash.
    await createSale(
      db,
      ctx,
      sale({ items: [{ productId: p.id, quantity: 1 }], paymentMethod: "card" }),
      opts,
    );
    // Partial credit: 1000 total, 400 cash → +400.
    await createSale(
      db,
      ctx,
      sale({ items: [{ productId: p.id, quantity: 1 }], customerId: c.id, amountPaid: 400 }),
      opts,
    );
    // Customer pays 300 in cash → +300.
    await recordCustomerPayment(db, ctx, c.id, paymentInput.parse({ amount: 300 }));
    // Cash refund of one unit → −1000.
    await createReturn(
      db,
      ctx,
      s1.id,
      returnCreateInput.parse({ items: [{ saleItemId: s1.items[0].id, quantity: 1 }] }),
    );
    // Paid the delivery guy from the drawer → −250.
    await addCashMovement(db, ctx, { type: "out", amount: 250, reason: "Delivery" });

    const summary = await currentShift(db, ctx);
    expect(summary?.salesCount).toBe(3);
    expect(summary?.expectedCash).toBe(5000 + 2000 + 400 + 300 - 1000 - 250);

    const closed = await closeShift(db, ctx, { countedCash: 6400 });
    expect(closed.shift.status).toBe("closed");
    expect(closed.difference).toBe(6400 - 6450);
    expect(await currentShift(db, ctx)).toBeNull();
  });
});
