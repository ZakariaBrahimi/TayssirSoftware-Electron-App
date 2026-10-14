import { beforeEach, describe, expect, it } from "vitest";
import { parseCsv, parseDecimal, toCsv } from "@/lib/csv";
import { makeDb, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { exportProducts, importProducts } from "./data-io";
import { listProducts } from "./products";

describe("csv", () => {
  it("round-trips quotes, separators and new lines", () => {
    const rows = [
      ["name", "note"],
      ['Jus "Ifri"', "a,b;c\nd"],
      ["زيت", ""],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("reads Excel's semicolon format and decimal commas", () => {
    expect(parseCsv("name;price\r\nSucre;1 234,50\r\n")).toEqual([
      ["name", "price"],
      ["Sucre", "1 234,50"],
    ]);
    expect(parseDecimal("1 234,50")).toBe(1234.5);
    expect(parseDecimal("1,234.50")).toBe(1234.5);
    expect(parseDecimal("12.5")).toBe(12.5);
    expect(parseDecimal("abc")).toBeNaN();
  });
});

describe("product import", () => {
  let db: Database;
  let ctx: Ctx;
  beforeEach(async () => {
    db = await makeDb();
    ({ ctx } = await makeStore(db));
  });

  const csv = `nom;code-barres;catégorie;prix_achat;prix_vente;stock
Sucre 1kg;111;Épicerie;90;110,50;20
Huile 1L;222;Épicerie;550;650;5
`;

  it("previews, then creates products with categories and stock", async () => {
    const preview = await importProducts(db, ctx, "DZD", csv, { dryRun: true });
    expect(preview).toMatchObject({ rows: 2, created: 2, updated: 0, errors: [] });
    expect(
      (await listProducts(db, ctx, { stock: "all", sort: "name", page: 1, pageSize: 20 })).total,
    ).toBe(0);

    await importProducts(db, ctx, "DZD", csv, { dryRun: false });
    const list = await listProducts(db, ctx, { stock: "all", sort: "name", page: 1, pageSize: 20 });
    expect(list.rows.map((r) => [r.name, r.salePrice, r.stock, r.categoryName])).toEqual([
      ["Huile 1L", 65000, 5, "Épicerie"],
      ["Sucre 1kg", 11050, 20, "Épicerie"],
    ]);

    // Re-import updates by barcode and turns the new stock into an adjustment.
    const update = await importProducts(
      db,
      ctx,
      "DZD",
      "name,barcode,sale_price,stock\nSucre,111,120,25\n",
      {
        dryRun: false,
      },
    );
    expect(update).toMatchObject({ created: 0, updated: 1 });
    const sugar = (
      await listProducts(db, ctx, { q: "111", stock: "all", sort: "name", page: 1, pageSize: 5 })
    ).rows[0];
    expect([sugar.name, sugar.salePrice, sugar.stock]).toEqual(["Sucre", 12000, 25]);

    const exported = await exportProducts(db, ctx, "DZD");
    expect(parseCsv(exported)[0][0]).toBe("name");
    expect(parseCsv(exported)).toHaveLength(3);
  });

  it("reports invalid rows and writes nothing", async () => {
    const report = await importProducts(
      db,
      ctx,
      "DZD",
      "name,barcode,sale_price\nA,111,x\n,222,5\nB,111,5\nC,333,-1\n",
      {
        dryRun: false,
      },
    );
    expect(report.errors.map((e) => [e.line, e.message])).toEqual([
      [2, "invalid_sale_price"],
      [3, "name_required"],
      [5, "invalid_sale_price"],
    ]);
    expect(
      (await listProducts(db, ctx, { stock: "all", sort: "name", page: 1, pageSize: 20 })).total,
    ).toBe(0);
  });
});
