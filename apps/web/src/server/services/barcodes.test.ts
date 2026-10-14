import { beforeEach, describe, expect, it } from "vitest";
import { productCreateInput } from "@/lib/validators";
import { makeDb, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { exportProducts, importProducts } from "./data-io";
import {
  addBarcode,
  createProduct,
  deleteProduct,
  findByBarcode,
  isBarcodeTaken,
  listProducts,
  updateProduct,
} from "./products";
import { getQuickKeys, saveQuickKeys } from "./quick-keys";

let db: Database;
let ctx: Ctx;

beforeEach(async () => {
  db = await makeDb();
  ({ ctx } = await makeStore(db));
});

const product = (name: string, barcode: string, extraBarcodes?: string[]) =>
  createProduct(
    db,
    ctx,
    productCreateInput.parse({
      name,
      barcode,
      costPrice: 30,
      salePrice: 45,
      stock: 10,
      extraBarcodes,
    }),
  );

describe("other barcodes", () => {
  it("finds a product by any of its barcodes and refuses barcodes of other products", async () => {
    const water = await product("Water", "6130000000014", ["6130000000021", "6130000000014"]);
    // The main barcode is not repeated in the others.
    expect(water.extraBarcodes).toEqual(["6130000000021"]);
    expect((await findByBarcode(db, ctx, "6130000000021")).id).toBe(water.id);
    expect(await isBarcodeTaken(db, ctx, "6130000000021")).toBe(true);
    expect(await isBarcodeTaken(db, ctx, "6130000000021", water.id)).toBe(false);

    await expect(product("Juice", "6130000000021")).rejects.toMatchObject({
      code: "BARCODE_TAKEN",
    });
    await expect(product("Juice", "777", ["6130000000014"])).rejects.toMatchObject({
      code: "BARCODE_TAKEN",
    });

    // Search by another barcode.
    const found = await listProducts(db, ctx, {
      q: "6130000000021",
      stock: "all",
      sort: "name",
      page: 1,
      pageSize: 20,
    });
    expect(found.rows.map((r) => r.id)).toEqual([water.id]);

    // Link a newly scanned barcode, then replace the list.
    const linked = await addBarcode(db, ctx, water.id, "SUPPLIER-B");
    expect(linked.extraBarcodes).toEqual(["6130000000021", "SUPPLIER-B"]);
    const updated = await updateProduct(db, ctx, water.id, { extraBarcodes: ["SUPPLIER-B"] });
    expect(updated.extraBarcodes).toEqual(["SUPPLIER-B"]);
    await expect(findByBarcode(db, ctx, "6130000000021")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // A deleted product frees its barcodes.
    await deleteProduct(db, ctx, water.id);
    expect(await isBarcodeTaken(db, ctx, "SUPPLIER-B")).toBe(false);
  });

  it("imports and exports other barcodes", async () => {
    const report = await importProducts(
      db,
      ctx,
      "DZD",
      "name;barcode;sale_price;other_barcodes\nWater;111;45;222 | 333\nJuice;444;90;",
      { dryRun: false },
    );
    expect(report).toMatchObject({ created: 2, errors: [] });
    expect((await findByBarcode(db, ctx, "333")).name).toBe("Water");
    expect(await exportProducts(db, ctx, "DZD")).toContain("222 | 333");

    const clash = await importProducts(
      db,
      ctx,
      "DZD",
      "name;barcode;sale_price;other_barcodes\nJuice;444;90;222",
      {
        dryRun: true,
      },
    );
    expect(clash.errors).toEqual([{ line: 2, message: "barcode_in_use" }]);
  });
});

describe("quick buttons", () => {
  it("saves pages of buttons and leaves out deleted products", async () => {
    const bread = await product("Baguette", "B1");
    const bag = await product("Sachet", "S1");
    const saved = await saveQuickKeys(db, ctx, [
      {
        name: "Boulangerie",
        keys: [
          { productId: bread.id, label: "Pain", color: "amber" },
          { productId: bag.id, label: "", color: "slate" },
        ],
      },
    ]);
    expect(saved.pages[0].keys.map((k) => [k.label, k.product.name])).toEqual([
      ["Pain", "Baguette"],
      ["", "Sachet"],
    ]);
    await deleteProduct(db, ctx, bag.id);
    const after = await getQuickKeys(db, ctx);
    expect(after.pages[0].keys.map((k) => k.product.name)).toEqual(["Baguette"]);
  });
});
