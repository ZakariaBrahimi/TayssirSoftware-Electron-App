import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { parseCsv, parseDecimal, toCsv } from "@/lib/csv";
import { toMajor, toMinor } from "@/lib/money";
import { barcodeSchema } from "@/lib/validators";
import type { Ctx } from "../context";
import type { Database, Executor } from "../db/client";
import { brands, categories, customers, products, saleItems, sales } from "../db/schema";
import { brandService, categoryService } from "./catalog";
import { customerBalanceSql } from "./customers";
import { moveStock } from "./stock";

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
  "active",
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
      isActive: products.isActive,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(brands, eq(brands.id, products.brandId))
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
      r.isActive ? "yes" : "no",
    ]),
  ]);
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

const HEADER_ALIASES: Record<string, (typeof PRODUCT_COLUMNS)[number]> = {
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
  active: "active",
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
  const get = (row: string[], key: (typeof PRODUCT_COLUMNS)[number]) =>
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
    isActive: boolean;
  };
  const parsed: Parsed[] = [];
  const seen = new Set<string>();

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

    const fail = (message: string) => report.errors.push({ line, message });
    if (!name) return fail("name_required");
    if (!barcodeSchema.safeParse(barcode).success) return fail("invalid_barcode");
    if (seen.has(barcode)) return fail("duplicate_barcode");
    if (!Number.isFinite(sale) || sale < 0) return fail("invalid_sale_price");
    if (!Number.isFinite(cost) || cost < 0) return fail("invalid_cost_price");
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return fail("invalid_stock");
    if (low !== null && (!Number.isInteger(low) || low < 0))
      return fail("invalid_low_stock_threshold");
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
      isActive: !["no", "non", "false", "0", "لا"].includes(activeRaw),
    });
  });

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
    for (const p of parsed) {
      const categoryId = p.category
        ? await categoryService.findOrCreate(tx, ctx, p.category)
        : null;
      const brandId = p.brand ? await brandService.findOrCreate(tx, ctx, p.brand) : null;
      const fields = {
        name: p.name,
        costPrice: p.costPrice,
        salePrice: p.salePrice,
        isActive: p.isActive,
        ...(p.category ? { categoryId } : {}),
        ...(p.brand ? { brandId } : {}),
        ...(p.lowStockThreshold !== null ? { lowStockThreshold: p.lowStockThreshold } : {}),
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
          change: p.stock - currentStock,
          reason: current ? "adjustment" : "initial",
          note: "CSV import",
        });
      }
    }
  });
  return report;
}
