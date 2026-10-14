import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  familyInput,
  type FamilyInput,
  productCreateInput,
  saleCreateInput,
} from "@/lib/validators";
import { makeDb, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { products } from "../db/schema";
import { createFamily, deleteFamily, getFamily, updateFamily } from "./families";
import { createProduct, findByBarcode, listProducts } from "./products";
import { createSale } from "./sales";

let db: Database;
let ctx: Ctx;

beforeEach(async () => {
  db = await makeDb();
  ({ ctx } = await makeStore(db));
});

const shoe = (overrides: Partial<FamilyInput> = {}): FamilyInput => ({
  name: "Air Max",
  options: [
    { name: "Size", values: ["41", "42"] },
    { name: "Colour", values: ["Black", "White"] },
  ],
  variants: [
    {
      values: ["42", "White"],
      barcode: "SHOE-42W",
      costPrice: 500000,
      salePrice: 900000,
      stock: 2,
    },
    { values: ["41", "Black"], costPrice: 500000, salePrice: 900000, stock: 3 },
    { values: ["42", "Black"], costPrice: 500000, salePrice: 950000 },
  ],
  ...overrides,
});

describe("product families", () => {
  it("creates one product per variant, sorted by option values", async () => {
    const family = await createFamily(db, ctx, familyInput.parse(shoe()));
    expect(family.variants.map((v) => v.values)).toEqual([
      ["41", "Black"],
      ["42", "Black"],
      ["42", "White"],
    ]);
    expect(family.variants.map((v) => v.name)).toEqual([
      "Air Max — 41 / Black",
      "Air Max — 42 / Black",
      "Air Max — 42 / White",
    ]);
    expect(family.variants.map((v) => v.stock)).toEqual([3, 0, 2]);
    // Missing barcodes are generated.
    expect(family.variants[0].barcode).toMatch(/^\d{13}$/);

    // Variants are ordinary products: scan and sell them.
    const scanned = await findByBarcode(db, ctx, "SHOE-42W");
    expect(scanned).toMatchObject({ familyId: family.id, familyName: "Air Max" });
    await createSale(
      db,
      ctx,
      saleCreateInput.parse({ items: [{ productId: scanned.id, quantity: 1 }] }),
      { deviceCode: "T" },
    );
    expect((await getFamily(db, ctx, family.id)).variants[2].stock).toBe(1);
  });

  it("rejects bad option combinations, duplicates and taken barcodes", async () => {
    const parsed = (input: FamilyInput) => familyInput.safeParse(input).success;
    expect(
      parsed(shoe({ variants: [{ values: ["43", "Black"], costPrice: 0, salePrice: 0 }] })),
    ).toBe(false);
    expect(
      parsed(
        shoe({
          variants: [
            { values: ["41", "Black"], costPrice: 0, salePrice: 0 },
            { values: ["41", "black"], costPrice: 0, salePrice: 0 },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      parsed(shoe({ variants: [{ values: ["41", "Black"], costPrice: 10, salePrice: 5 }] })),
    ).toBe(false);

    await createProduct(
      db,
      ctx,
      productCreateInput.parse({ name: "Other", barcode: "SHOE-42W", costPrice: 0, salePrice: 0 }),
    );
    await expect(createFamily(db, ctx, familyInput.parse(shoe()))).rejects.toMatchObject({
      code: "BARCODE_TAKEN",
    });
  });

  it("renames, adds, updates and removes variants; stock stays put", async () => {
    const family = await createFamily(db, ctx, familyInput.parse(shoe()));
    const [b41, b42, w42] = family.variants;
    const updated = await updateFamily(
      db,
      ctx,
      family.id,
      familyInput.parse({
        name: "Air Max 90",
        options: [
          { name: "Size", values: ["41", "42", "43"] },
          { name: "Colour", values: ["Black", "White"] },
        ],
        variants: [
          // Swap barcodes between two variants.
          {
            id: b41.id,
            values: b41.values,
            barcode: w42.barcode,
            costPrice: 1,
            salePrice: 2,
            stock: 99,
          },
          { id: w42.id, values: w42.values, barcode: b41.barcode, costPrice: 1, salePrice: 2 },
          { values: ["43", "Black"], costPrice: 1, salePrice: 2, stock: 4 },
        ],
      }),
    );
    expect(updated.name).toBe("Air Max 90");
    expect(updated.variants.map((v) => [v.name, v.stock])).toEqual([
      ["Air Max 90 — 41 / Black", 3], // opening stock ignored for existing variants
      ["Air Max 90 — 42 / White", 2],
      ["Air Max 90 — 43 / Black", 4],
    ]);
    expect(updated.variants[0].barcode).toBe(w42.barcode);
    // 42 / Black was left out: removed.
    const [gone] = await db.select().from(products).where(eq(products.id, b42.id));
    expect(gone.deletedAt).not.toBeNull();

    await deleteFamily(db, ctx, family.id);
    await expect(getFamily(db, ctx, family.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const list = await listProducts(db, ctx, { page: 1, pageSize: 20, sort: "name", stock: "all" });
    expect(list.total).toBe(0);
  });
});
