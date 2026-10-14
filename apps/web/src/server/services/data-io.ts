import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { parseCsv, parseDecimal, toCsv } from "@/lib/csv";
import { toMajor, toMinor } from "@/lib/money";
import { barcodeSchema } from "@/lib/validators";
import type { Ctx } from "../context";
import type { Database, Executor } from "../db/client";
import {
  brands,
  categories,
  customers,
  productFamilies,
  products,
  saleItems,
  sales,
} from "../db/schema";
import { brandService, categoryService } from "./catalog";
import { customerBalanceSql } from "./customers";
import { parseOptions, parseValues, variantName } from "./families";
import { moveStock } from "./stock";
import { hasAtMost3Decimals, isMeasured, round3, type Unit } from "@/lib/quantity";

/** Units accepted in CSV files, in English, French and Arabic. */
const UNIT_ALIASES: Record<string, Unit> = {
  piece: "piece",
  pièce: "piece",
  pc: "piece",
  pcs: "piece",
  u: "piece",
  unit: "piece",
  unité: "piece",
  قطعة: "piece",
  kg: "kg",
  kilo: "kg",
  كغ: "kg",
  g: "g",
  gramme: "g",
  غ: "g",
  l: "l",
  litre: "l",
  liter: "l",
  لتر: "l",
  m: "m",
  metre: "m",
  mètre: "m",
  meter: "m",
  متر: "m",
};

/* CSV export / import. Amounts are in major units (e.g. 120.50). */

export const PRODUCT_COLUMNS = [
  "name",
  "barcode",
  "category",
  "brand",
  "cost_price",
  "sale_price",
  "stock",
  "low_stock_threshold",
  "unit",
  "active",
  "vat_rate",
  // Variants: rows sharing a family are one product in several versions.
  "family",
  "option_1",
  "value_1",
  "option_2",
  "value_2",
  "option_3",
  "value_3",
] as const;
type Column = (typeof PRODUCT_COLUMNS)[number];
const OPTION_COLUMNS = [
  ["option_1", "value_1"],
  ["option_2", "value_2"],
  ["option_3", "value_3"],
] as const;

export async function exportProducts(db: Executor, ctx: Ctx, currency: string) {
  const rows = await db
    .select({
      name: products.name,
      barcode: products.barcode,
      category: categories.name,
      brand: brands.name,
      costPrice: products.costPrice,
      salePrice: products.salePrice,
      stock: products.stock,
      lowStockThreshold: products.lowStockThreshold,
      unit: products.unit,
      isActive: products.isActive,
      taxRate: products.taxRate,
      family: productFamilies.name,
      options: productFamilies.options,
      values: products.variantValues,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(
      productFamilies,
      and(eq(productFamilies.id, products.familyId), isNull(productFamilies.deletedAt)),
    )
    .where(and(eq(products.storeId, ctx.storeId), isNull(products.deletedAt)))
    .orderBy(asc(products.name));
  return toCsv([
    [...PRODUCT_COLUMNS],
    ...rows.map((r) => [
      r.name,
      r.barcode,
      r.category,
      r.brand,
      toMajor(r.costPrice, currency),
      toMajor(r.salePrice, currency),
      r.stock,
      r.lowStockThreshold,
      r.unit,
      r.isActive ? "yes" : "no",
      r.taxRate ?? "",
      ...variantCells(r.family, r.options, r.values),
    ]),
  ]);
}

/** family, option_1, value_1, ... cells of a variant (empty otherwise). */
function variantCells(
  family: string | null,
  optionsJson: string | null,
  valuesJson: string | null,
) {
  const cells: string[] = [family ?? ""];
  let names: string[] = [];
  try {
    names =
      family && optionsJson ? JSON.parse(optionsJson).map((o: { name: string }) => o.name) : [];
  } catch {
    names = [];
  }
  const values = family ? parseValues(valuesJson) : [];
  for (let k = 0; k < OPTION_COLUMNS.length; k++) cells.push(names[k] ?? "", values[k] ?? "");
  return cells;
}

export async function exportSales(
  db: Executor,
  ctx: Ctx,
  currency: string,
  range: { from?: string; to?: string },
) {
  const rows = await db
    .select({
      number: sql<string>`${sales.deviceCode} || '-' || ${sales.seq}`,
      date: sales.createdAt,
      status: sales.status,
      cashier: sales.cashierName,
      customer: sales.customerName,
      payment: sales.paymentMethod,
      product: saleItems.productName,
      barcode: saleItems.barcode,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      discount: saleItems.discount,
      lineTotal: saleItems.lineTotal,
      saleDiscount: sales.discount,
      saleTotal: sales.total,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(
      and(
        eq(sales.storeId, ctx.storeId),
        range.from ? gte(sales.createdAt, new Date(range.from)) : undefined,
        range.to ? lte(sales.createdAt, new Date(range.to)) : undefined,
      ),
    )
    .orderBy(desc(sales.createdAt));
  const m = (v: number) => toMajor(v, currency);
  return toCsv([
    [
      "sale",
      "date",
      "status",
      "cashier",
      "customer",
      "payment",
      "product",
      "barcode",
      "quantity",
      "unit_price",
      "line_discount",
      "line_total",
      "sale_discount",
      "sale_total",
    ],
    ...rows.map((r) => [
      r.number,
      r.date.toISOString(),
      r.status,
      r.cashier,
      r.customer,
      r.payment,
      r.product,
      r.barcode,
      r.quantity,
      m(r.unitPrice),
      m(r.discount),
      m(r.lineTotal),
      m(r.saleDiscount),
      m(r.saleTotal),
    ]),
  ]);
}

export async function exportCustomers(db: Executor, ctx: Ctx, currency: string) {
  const rows = await db
    .select({
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      creditLimit: customers.creditLimit,
      balance: customerBalanceSql,
    })
    .from(customers)
    .where(and(eq(customers.storeId, ctx.storeId), isNull(customers.deletedAt)))
    .orderBy(asc(customers.name));
  return toCsv([
    ["name", "phone", "email", "address", "credit_limit", "balance"],
    ...rows.map((r) => [
      r.name,
      r.phone,
      r.email,
      r.address,
      r.creditLimit === null ? "" : toMajor(r.creditLimit, currency),
      toMajor(Number(r.balance), currency),
    ]),
  ]);
}

export type ImportReport = {
  rows: number;
  created: number;
  updated: number;
  errors: { line: number; message: string }[];
};

const HEADER_ALIASES: Record<string, Column> = {
  name: "name",
  nom: "name",
  barcode: "barcode",
  "code-barres": "barcode",
  code_barres: "barcode",
  category: "category",
  categorie: "category",
  catégorie: "category",
  brand: "brand",
  marque: "brand",
  cost_price: "cost_price",
  cost: "cost_price",
  prix_achat: "cost_price",
  sale_price: "sale_price",
  price: "sale_price",
  prix_vente: "sale_price",
  prix: "sale_price",
  stock: "stock",
  quantity: "stock",
  quantite: "stock",
  quantité: "stock",
  low_stock_threshold: "low_stock_threshold",
  unit: "unit",
  unite: "unit",
  unité: "unit",
  active: "active",
  actif: "active",
  vat_rate: "vat_rate",
  vat: "vat_rate",
  tva: "vat_rate",
  taux_tva: "vat_rate",
  family: "family",
  famille: "family",
  option_1: "option_1",
  option_2: "option_2",
  option_3: "option_3",
  value_1: "value_1",
  value_2: "value_2",
  value_3: "value_3",
  valeur_1: "value_1",
  valeur_2: "value_2",
  valeur_3: "value_3",
};

/**
 * Imports products from CSV. Rows are matched by barcode: existing
 * products are updated (a different stock becomes a stock adjustment),
 * new ones are created. With `dryRun`, nothing is written.
 */
export async function importProducts(
  db: Database,
  ctx: Ctx,
  currency: string,
  csv: string,
  opts: { dryRun: boolean },
): Promise<ImportReport> {
  const [header, ...lines] = parseCsv(csv);
  const report: ImportReport = { rows: lines.length, created: 0, updated: 0, errors: [] };
  if (!header) return { ...report, errors: [{ line: 1, message: "empty_file" }] };

  const index = new Map<string, number>();
  header.forEach((h, i) => {
    const key = HEADER_ALIASES[h.trim().toLowerCase().replace(/\s+/g, "_")];
    if (key && !index.has(key)) index.set(key, i);
  });
  for (const required of ["name", "barcode", "sale_price"] as const) {
    if (!index.has(required)) {
      return { ...report, errors: [{ line: 1, message: `missing_column:${required}` }] };
    }
  }
  const get = (row: string[], key: Column) =>
    index.has(key) ? (row[index.get(key)!] ?? "").trim() : "";

  type Parsed = {
    line: number;
    name: string;
    barcode: string;
    category: string;
    brand: string;
    costPrice: number;
    salePrice: number;
    stock: number | null;
    lowStockThreshold: number | null;
    unit: Unit | null;
    isActive: boolean;
    /** undefined: leave as is; null: the store's rate. */
    taxRate: number | null | undefined;
    family: string;
    options: string[];
    values: string[];
  };
  const parsed: Parsed[] = [];
  const seen = new Set<string>();

  // Units of products already in the store (rows may leave the unit out).
  const existingUnit = new Map(
    (
      await db
        .select({ barcode: products.barcode, unit: products.unit })
        .from(products)
        .where(and(eq(products.storeId, ctx.storeId), isNull(products.deletedAt)))
    ).map((p) => [p.barcode, p.unit]),
  );
  lines.forEach((row, i) => {
    const line = i + 2;
    const name = get(row, "name");
    const barcode = get(row, "barcode");
    const sale = parseDecimal(get(row, "sale_price"));
    const costRaw = get(row, "cost_price");
    const cost = costRaw === "" ? 0 : parseDecimal(costRaw);
    const stockRaw = get(row, "stock");
    const stock = stockRaw === "" ? null : parseDecimal(stockRaw);
    const lowRaw = get(row, "low_stock_threshold");
    const low = lowRaw === "" ? null : parseDecimal(lowRaw);
    const activeRaw = get(row, "active").toLowerCase();
    const unitRaw = get(row, "unit").toLowerCase();
    const unit = unitRaw === "" ? null : (UNIT_ALIASES[unitRaw] ?? undefined);

    const fail = (message: string) => report.errors.push({ line, message });
    if (!name) return fail("name_required");
    if (!barcodeSchema.safeParse(barcode).success) return fail("invalid_barcode");
    if (seen.has(barcode)) return fail("duplicate_barcode");
    if (!Number.isFinite(sale) || sale < 0) return fail("invalid_sale_price");
    if (!Number.isFinite(cost) || cost < 0) return fail("invalid_cost_price");
    if (unit === undefined) return fail("invalid_unit");
    const measured = isMeasured(unit ?? existingUnit.get(barcode));
    const validAmount = (n: number) =>
      n >= 0 && (measured ? hasAtMost3Decimals(n) : Number.isInteger(n));
    if (stock !== null && !validAmount(stock)) return fail("invalid_stock");
    if (low !== null && !validAmount(low)) return fail("invalid_low_stock_threshold");
    const vatRaw = get(row, "vat_rate").replace("%", "").trim();
    const vat = vatRaw === "" ? undefined : parseDecimal(vatRaw);
    if (
      vat !== undefined &&
      (!Number.isFinite(vat) || vat < 0 || vat > 100 || Math.round(vat * 100) !== vat * 100)
    ) {
      return fail("invalid_vat_rate");
    }
    const family = get(row, "family");
    const options: string[] = [];
    const values: string[] = [];
    for (const [optionKey, valueKey] of OPTION_COLUMNS) {
      const option = get(row, optionKey);
      const value = get(row, valueKey);
      if (!option && !value) break;
      options.push(option);
      values.push(value);
    }
    if (family) {
      if (!values.length || options.some((o) => !o || o.length > 30)) {
        return fail("invalid_variant");
      }
      if (values.some((v) => !v || v.length > 30) || family.length > 100) {
        return fail("invalid_variant");
      }
    }
    seen.add(barcode);
    parsed.push({
      line,
      name,
      barcode,
      category: get(row, "category"),
      brand: get(row, "brand"),
      costPrice: toMinor(cost, currency),
      salePrice: toMinor(sale, currency),
      stock,
      lowStockThreshold: low,
      unit,
      isActive: !["no", "non", "false", "0", "لا"].includes(activeRaw),
      taxRate: vat,
      family,
      options: family ? options : [],
      values: family ? values : [],
    });
  });

  // Variants of one family must use the same options and differ in values.
  const families = new Map<string, { name: string; options: string[]; combos: Set<string> }>();
  for (const p of parsed) {
    if (!p.family) continue;
    const key = p.family.toLowerCase();
    const fam = families.get(key) ?? { name: p.family, options: p.options, combos: new Set() };
    families.set(key, fam);
    const sameOptions =
      fam.options.length === p.options.length &&
      fam.options.every((o, k) => o.toLowerCase() === p.options[k].toLowerCase());
    const combo = p.values.join("\u0000").toLowerCase();
    if (!sameOptions) report.errors.push({ line: p.line, message: "inconsistent_options" });
    else if (fam.combos.has(combo)) {
      report.errors.push({ line: p.line, message: "duplicate_variant" });
    }
    fam.combos.add(combo);
  }
  // Families already in the store, matched by name.
  const storeFamilies = new Map(
    (
      await db
        .select({
          id: productFamilies.id,
          name: productFamilies.name,
          options: productFamilies.options,
        })
        .from(productFamilies)
        .where(and(eq(productFamilies.storeId, ctx.storeId), isNull(productFamilies.deletedAt)))
    ).map((f) => [f.name.toLowerCase(), f]),
  );
  for (const p of parsed) {
    const known = p.family ? storeFamilies.get(p.family.toLowerCase()) : undefined;
    if (!known) continue;
    const names = parseOptions(known.options).map((o) => o.name.toLowerCase());
    const same =
      names.length === p.options.length && names.every((n, k) => n === p.options[k].toLowerCase());
    if (!same) report.errors.push({ line: p.line, message: "inconsistent_options" });
  }

  const existing = new Map(
    (
      await db
        .select({ id: products.id, barcode: products.barcode, stock: products.stock })
        .from(products)
        .where(and(eq(products.storeId, ctx.storeId), isNull(products.deletedAt)))
    ).map((p) => [p.barcode, p]),
  );
  for (const p of parsed) {
    if (existing.has(p.barcode)) report.updated++;
    else report.created++;
  }
  if (opts.dryRun || report.errors.length) return report;

  await db.transaction(async (tx) => {
    // Create the new families and add new option values to existing ones.
    const familyIds = new Map<string, string>();
    for (const [key, fam] of families) {
      const rows = parsed.filter((p) => p.family.toLowerCase() === key);
      const known = storeFamilies.get(key);
      const options: { name: string; values: string[] }[] = known
        ? parseOptions(known.options)
        : fam.options.map((name) => ({ name, values: [] }));
      for (const p of rows) {
        p.values.forEach((value, k) => {
          if (!options[k].values.includes(value)) options[k].values.push(value);
        });
      }
      if (known) {
        await tx
          .update(productFamilies)
          .set({ options: JSON.stringify(options) })
          .where(eq(productFamilies.id, known.id));
        familyIds.set(key, known.id);
      } else {
        const [row] = await tx
          .insert(productFamilies)
          .values({ storeId: ctx.storeId, name: fam.name, options: JSON.stringify(options) })
          .returning({ id: productFamilies.id });
        familyIds.set(key, row.id);
      }
    }

    for (const p of parsed) {
      const familyName = p.family
        ? (storeFamilies.get(p.family.toLowerCase())?.name ??
          families.get(p.family.toLowerCase())!.name)
        : null;
      const categoryId = p.category
        ? await categoryService.findOrCreate(tx, ctx, p.category)
        : null;
      const brandId = p.brand ? await brandService.findOrCreate(tx, ctx, p.brand) : null;
      const fields = {
        name: familyName ? variantName(familyName, p.values) : p.name,
        ...(familyName
          ? {
              familyId: familyIds.get(p.family.toLowerCase())!,
              variantValues: JSON.stringify(p.values),
            }
          : {}),
        ...(p.taxRate !== undefined ? { taxRate: p.taxRate } : {}),
        costPrice: p.costPrice,
        salePrice: p.salePrice,
        isActive: p.isActive,
        ...(p.category ? { categoryId } : {}),
        ...(p.brand ? { brandId } : {}),
        ...(p.lowStockThreshold !== null ? { lowStockThreshold: p.lowStockThreshold } : {}),
        ...(p.unit !== null ? { unit: p.unit } : {}),
      };
      const current = existing.get(p.barcode);
      let productId: string;
      let currentStock = 0;
      if (current) {
        productId = current.id;
        currentStock = current.stock;
        await tx.update(products).set(fields).where(eq(products.id, current.id));
      } else {
        const [row] = await tx
          .insert(products)
          .values({ ...fields, storeId: ctx.storeId, barcode: p.barcode })
          .returning({ id: products.id });
        productId = row.id;
      }
      if (p.stock !== null && p.stock !== currentStock) {
        await moveStock(tx, ctx, {
          productId,
          change: round3(p.stock - currentStock),
          reason: current ? "adjustment" : "initial",
          note: "CSV import",
        });
      }
    }
  });
  return report;
}
