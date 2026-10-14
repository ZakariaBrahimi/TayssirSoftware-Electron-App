/**
 * Seeds demo catalog data (categories, brands, products).
 * Usage: npm run db:seed
 */
import { generateInternalEan13 } from "../../lib/barcode";
import { createDb } from "./client";
import { runMigrations } from "./migrate";
import { brands, categories, products, stockMovements } from "./schema";

const db = createDb(
  process.env.DATABASE_URL ?? "file:./data/tayssir.db",
  process.env.DATABASE_AUTH_TOKEN,
);

async function main() {
  await runMigrations(db);

  const cats = await db
    .insert(categories)
    .values([{ name: "Beverages" }, { name: "Snacks" }, { name: "Household" }])
    .onConflictDoNothing()
    .returning();
  const brs = await db
    .insert(brands)
    .values([{ name: "Ifri" }, { name: "Cevital" }, { name: "Generic" }])
    .onConflictDoNothing()
    .returning();

  if (!cats.length || !brs.length) {
    console.log("Demo data already present, skipping.");
    return;
  }

  const demo = [
    { name: "Mineral water 1.5L", cost: 3000, price: 4500, stock: 120, c: 0, b: 0 },
    { name: "Orange juice 1L", cost: 12000, price: 16000, stock: 40, c: 0, b: 0 },
    { name: "Sunflower oil 1L", cost: 55000, price: 65000, stock: 25, c: 2, b: 1 },
    { name: "Sugar 1kg", cost: 9000, price: 11000, stock: 60, c: 2, b: 1 },
    { name: "Chocolate biscuits", cost: 6000, price: 9000, stock: 4, c: 1, b: 2 },
    { name: "Potato chips", cost: 4000, price: 6000, stock: 0, c: 1, b: 2 },
  ];

  for (const p of demo) {
    const [row] = await db
      .insert(products)
      .values({
        name: p.name,
        barcode: generateInternalEan13(),
        costPrice: p.cost,
        salePrice: p.price,
        stock: p.stock,
        categoryId: cats[p.c].id,
        brandId: brs[p.b].id,
      })
      .returning();
    if (p.stock > 0) {
      await db.insert(stockMovements).values({
        productId: row.id,
        change: p.stock,
        stockAfter: p.stock,
        reason: "initial",
      });
    }
  }
  console.log(`✔ Seeded ${demo.length} products`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
