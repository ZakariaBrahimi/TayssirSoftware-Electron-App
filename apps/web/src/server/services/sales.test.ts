import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { saleCreateInput } from "@/lib/validators";
import { createDb, type Database } from "../db/client";
import { runMigrations } from "../db/migrate";
import { products, stockMovements, user } from "../db/schema";
import { AppError } from "../errors";
import { createProduct } from "./products";
import { createSale, voidSale } from "./sales";

let db: Database;
const USER_ID = "user-1";

async function stockOf(id: number) {
  const [row] = await db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, id));
  return row.stock;
}

beforeEach(async () => {
  db = createDb(":memory:");
  await runMigrations(db);
  await db.insert(user).values({ id: USER_ID, name: "Cashier", email: "c@tayssir.local" });
});

async function product(stock: number, salePrice = 1000, costPrice = 600) {
  return createProduct(
    db,
    {
      name: `P${Math.random()}`,
      barcode: String(Math.random()).slice(2, 14),
      costPrice,
      salePrice,
      stock,
      lowStockThreshold: 5,
      isActive: true,
    },
    USER_ID,
  );
}

const sale = (input: unknown) => saleCreateInput.parse(input);

describe("createSale", () => {
  it("prices from the catalog, decrements stock and records movements", async () => {
    const p = await product(10, 1000, 600);
    const result = await createSale(
      db,
      sale({
        items: [{ productId: p.id, quantity: 3, discount: 100 }],
        discount: 400,
        amountPaid: 5000,
      }),
      USER_ID,
    );

    expect(result.subtotal).toBe(2900);
    expect(result.total).toBe(2500);
    expect(result.totalCost).toBe(1800);
    expect(result.changeDue).toBe(2500);
    expect(result.items).toHaveLength(1);
    expect(await stockOf(p.id)).toBe(7);

    const moves = await db.select().from(stockMovements).where(eq(stockMovements.productId, p.id));
    expect(moves.map((m) => m.reason).sort()).toEqual(["initial", "sale"]);
  });

  it("merges duplicate lines", async () => {
    const p = await product(10);
    const result = await createSale(
      db,
      sale({
        items: [
          { productId: p.id, quantity: 1 },
          { productId: p.id, quantity: 2 },
        ],
      }),
      USER_ID,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(3);
  });

  it("refuses to oversell and rolls back the whole sale", async () => {
    const a = await product(5);
    const b = await product(1);
    await expect(
      createSale(
        db,
        sale({
          items: [
            { productId: a.id, quantity: 2 },
            { productId: b.id, quantity: 2 },
          ],
        }),
        USER_ID,
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await stockOf(a.id)).toBe(5);
    expect(await stockOf(b.id)).toBe(1);
  });

  it("rejects insufficient cash payment and excessive discounts", async () => {
    const p = await product(5, 1000);
    await expect(
      createSale(db, sale({ items: [{ productId: p.id, quantity: 1 }], amountPaid: 500 }), USER_ID),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      createSale(db, sale({ items: [{ productId: p.id, quantity: 1 }], discount: 2000 }), USER_ID),
    ).rejects.toMatchObject({ code: "INVALID_DISCOUNT" });
  });
});

describe("voidSale", () => {
  it("restores stock once", async () => {
    const p = await product(5);
    const s = await createSale(db, sale({ items: [{ productId: p.id, quantity: 2 }] }), USER_ID);
    expect(await stockOf(p.id)).toBe(3);

    const voided = await voidSale(db, s.id, USER_ID);
    expect(voided.status).toBe("voided");
    expect(await stockOf(p.id)).toBe(5);

    await expect(voidSale(db, s.id, USER_ID)).rejects.toMatchObject({
      code: "SALE_ALREADY_VOIDED",
    });
    expect(await stockOf(p.id)).toBe(5);
  });
});
