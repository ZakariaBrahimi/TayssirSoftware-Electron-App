/**
 * Seeds demo catalog data into the local store (run the first-run setup
 * in the app first). Usage: npm run db:seed
 */
import { generateInternalEan13 } from "../../lib/barcode";
import { createDb } from "./client";
import { runMigrations } from "./migrate";
import { brands, categories, customers, products, stockMovements, stores, suppliers } from "./schema";

const db = createDb(
  process.env.DATABASE_URL ?? "file:./data/tayssir.db",
  process.env.DATABASE_AUTH_TOKEN,
);

async function main() {
  await runMigrations(db);
  const [store] = await db.select().from(stores).limit(1);
  if (!store) {
    console.error("No store yet: open the app and complete the first-run setup first.");
    process.exit(1);
  }
  const storeId = store.id;

  const cats = await db
    .insert(categories)
    .values(["Beverages", "Snacks", "Household"].map((name) => ({ storeId, name })))
    .returning();
  const brs = await db
    .insert(brands)
    .values(["Ifri", "Cevital", "Generic"].map((name) => ({ storeId, name })))
    .returning();

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
        storeId,
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
      await db
        .insert(stockMovements)
        .values({ storeId, productId: row.id, change: p.stock, reason: "initial" });
    }
  }
  await db.insert(customers).values([
    { storeId, name: "Karim Benali", phone: "0550 12 34 56", creditLimit: 2_000_000 },
    { storeId, name: "Amina Haddad", phone: "0661 98 76 54" },
  ]);
  await db.insert(suppliers).values([{ storeId, name: "Grossiste El Baraka", phone: "021 45 67 89" }]);
  console.log(`✔ Seeded ${demo.length} products, 2 customers and 1 supplier into "${store.name}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
