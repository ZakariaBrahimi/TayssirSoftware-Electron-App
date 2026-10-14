import { and, asc, count, desc, eq, isNull, like, lte, ne, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { generateInternalEan13 } from "@/lib/barcode";
import type {
  ProductCreateInput,
  ProductUpdateInput,
  StockAdjustmentInput,
  productCreateInput,
  productListQuery,
} from "@/lib/validators";
import type { Ctx } from "../context";
import type { Database, Executor } from "../db/client";
import { brands, categories, products, stockMovements, stores } from "../db/schema";
import { AppError } from "../errors";
import { isMeasured, round3 } from "@/lib/quantity";
import { parseScaleBarcode } from "@/lib/scale-barcode";
import { moveStock } from "./stock";

const productColumns = {
  id: products.id,
  name: products.name,
  barcode: products.barcode,
  description: products.description,
  costPrice: products.costPrice,
  salePrice: products.salePrice,
  stock: products.stock,
  lowStockThreshold: products.lowStockThreshold,
  unit: products.unit,
  scaleCode: products.scaleCode,
  isActive: products.isActive,
  categoryId: products.categoryId,
  brandId: products.brandId,
  categoryName: categories.name,
  brandName: brands.name,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
};

function baseSelect(db: Executor) {
  return db
    .select(productColumns)
    .from(products)
    .leftJoin(categories, and(eq(products.categoryId, categories.id), isNull(categories.deletedAt)))
    .leftJoin(brands, and(eq(products.brandId, brands.id), isNull(brands.deletedAt)));
}

const live = (ctx: Ctx) => and(eq(products.storeId, ctx.storeId), isNull(products.deletedAt));

export type ProductDTO = Awaited<ReturnType<typeof getProduct>>;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listProducts(
  db: Executor,
  ctx: Ctx,
  query: z.output<typeof productListQuery>,
) {
  const filters: (SQL | undefined)[] = [live(ctx)];
  if (!query.includeInactive) filters.push(eq(products.isActive, true));
  if (query.q) {
    const term = `%${escapeLike(query.q)}%`;
    filters.push(
      or(
        sql`${products.name} like ${term} escape '\\'`,
        like(products.barcode, `${escapeLike(query.q)}%`),
      ),
    );
  }
  if (query.categoryId) filters.push(eq(products.categoryId, query.categoryId));
  if (query.brandId) filters.push(eq(products.brandId, query.brandId));
  if (query.stock === "out") filters.push(lte(products.stock, 0));
  if (query.stock === "low") filters.push(lte(products.stock, products.lowStockThreshold));
  const where = and(...filters);

  const isDesc = query.sort.startsWith("-");
  const key = query.sort.replace(/^-/, "") as "name" | "stock" | "salePrice" | "createdAt";
  const order = isDesc ? desc(products[key]) : asc(products[key]);

  const [rows, [{ total }]] = await Promise.all([
    baseSelect(db)
      .where(where)
      .orderBy(order, asc(products.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(products).where(where),
  ]);

  return {
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getProduct(db: Executor, ctx: Ctx, id: string) {
  const [row] = await baseSelect(db).where(and(eq(products.id, id), live(ctx)));
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

/**
 * Finds the product of a scanned barcode. Label-scale barcodes (when the
 * store uses them) also give the quantity: weight, or price ÷ unit price.
 */
export async function findByBarcode(db: Executor, ctx: Ctx, barcode: string) {
  const [row] = await baseSelect(db)
    .where(and(eq(products.barcode, barcode), eq(products.isActive, true), live(ctx)))
    // If an offline sync produced duplicates, prefer the most recent.
    .orderBy(desc(products.updatedAt))
    .limit(1);
  if (row) return { ...row, scaleQuantity: null as number | null };

  const scale = parseScaleBarcode(barcode);
  if (scale) {
    const [store] = await db
      .select({ mode: stores.scaleBarcodes })
      .from(stores)
      .where(eq(stores.id, ctx.storeId));
    if (store && store.mode !== "off") {
      const [product] = await baseSelect(db)
        .where(and(eq(products.scaleCode, scale.code), eq(products.isActive, true), live(ctx)))
        .orderBy(desc(products.updatedAt))
        .limit(1);
      if (product) {
        const quantity =
          store.mode === "weight"
            ? scaleWeight(scale.value, product.unit)
            : product.salePrice > 0
              ? round3(toMinorWhole(scale.value) / product.salePrice)
              : 0;
        if (quantity > 0) return { ...product, scaleQuantity: quantity };
      }
    }
  }
  throw new AppError("NOT_FOUND");
}

/** Scale value → quantity in the product's unit (grams on the label). */
function scaleWeight(grams: number, unit: string) {
  return unit === "g" ? grams : round3(grams / 1000);
}

/** Scale prices are printed in whole currency units (e.g. dinars). */
const toMinorWhole = (units: number) => units * 100;

export async function isBarcodeTaken(db: Executor, ctx: Ctx, barcode: string, exceptId?: string) {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        live(ctx),
        eq(products.barcode, barcode),
        exceptId ? ne(products.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Returns an internal EAN-13 barcode that is not used in this store yet. */
export async function generateUniqueBarcode(db: Executor, ctx: Ctx) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateInternalEan13();
    if (!(await isBarcodeTaken(db, ctx, code))) return code;
  }
  throw new AppError("INTERNAL_ERROR", "Could not generate a unique barcode");
}

function assertPrices(input: { costPrice?: number; salePrice?: number }) {
  if (
    input.costPrice !== undefined &&
    input.salePrice !== undefined &&
    input.salePrice < input.costPrice
  ) {
    throw new AppError("VALIDATION_ERROR", "Sale price is lower than cost", {
      field: "salePrice",
      reason: "price_below_cost",
    });
  }
}

export async function createProduct(
  db: Database,
  ctx: Ctx,
  input: z.output<typeof productCreateInput>,
) {
  assertPrices(input);
  if (await isBarcodeTaken(db, ctx, input.barcode)) throw new AppError("BARCODE_TAKEN");
  const { stock, ...fields } = input;
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(products)
      .values({ ...fields, storeId: ctx.storeId, stock: 0 })
      .returning({ id: products.id });
    if (stock > 0) {
      await moveStock(tx, ctx, { productId: row.id, change: stock, reason: "initial" });
    }
    return row.id;
  });
  return getProduct(db, ctx, id);
}

/** Convenience overload for callers holding the raw (input) shape. */
export type CreateProductInput = ProductCreateInput;

export async function updateProduct(db: Database, ctx: Ctx, id: string, input: ProductUpdateInput) {
  const current = await getProduct(db, ctx, id);
  assertPrices({
    costPrice: input.costPrice ?? current.costPrice,
    salePrice: input.salePrice ?? current.salePrice,
  });
  if (input.barcode && (await isBarcodeTaken(db, ctx, input.barcode, id))) {
    throw new AppError("BARCODE_TAKEN");
  }
  await db
    .update(products)
    .set(input)
    .where(and(eq(products.id, id), live(ctx)));
  return getProduct(db, ctx, id);
}

/** Soft delete: the product disappears; past sales keep their snapshot. */
export async function deleteProduct(db: Executor, ctx: Ctx, id: string) {
  const [row] = await db
    .update(products)
    .set({ deletedAt: new Date(), isActive: false })
    .where(and(eq(products.id, id), live(ctx)))
    .returning({ id: products.id });
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

export async function adjustStock(db: Database, ctx: Ctx, id: string, input: StockAdjustmentInput) {
  const product = await getProduct(db, ctx, id);
  if (!isMeasured(product.unit) && !Number.isInteger(input.change)) {
    throw new AppError("QUANTITY_WHOLE", undefined, { name: product.name });
  }
  await db.transaction(async (tx) => {
    const moved = await moveStock(tx, ctx, {
      productId: id,
      change: input.change,
      reason: "adjustment",
      note: input.note,
      // Never let an adjustment push stock below zero.
      requireAvailable: input.change < 0,
    });
    if (!moved) throw new AppError("INSUFFICIENT_STOCK");
  });
  return getProduct(db, ctx, id);
}

export async function listStockMovements(db: Executor, ctx: Ctx, productId: string) {
  return db
    .select({
      id: stockMovements.id,
      change: stockMovements.change,
      reason: stockMovements.reason,
      refId: stockMovements.refId,
      note: stockMovements.note,
      userName: stockMovements.userName,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .where(and(eq(stockMovements.productId, productId), eq(stockMovements.storeId, ctx.storeId)))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(200);
}
