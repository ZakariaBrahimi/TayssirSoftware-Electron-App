import { and, asc, count, desc, eq, like, lte, or, sql, type SQL } from "drizzle-orm";
import { generateInternalEan13 } from "@/lib/barcode";
import type {
  ProductCreateInput,
  ProductUpdateInput,
  StockAdjustmentInput,
  productListQuery,
} from "@/lib/validators";
import type { z } from "zod";
import type { Database, Executor } from "../db/client";
import { brands, categories, products, stockMovements } from "../db/schema";
import { AppError, isUniqueViolation } from "../errors";

const productColumns = {
  id: products.id,
  name: products.name,
  barcode: products.barcode,
  description: products.description,
  costPrice: products.costPrice,
  salePrice: products.salePrice,
  stock: products.stock,
  lowStockThreshold: products.lowStockThreshold,
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
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id));
}

export type ProductDTO = Awaited<ReturnType<typeof getProduct>>;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listProducts(db: Executor, query: z.output<typeof productListQuery>) {
  const filters: SQL[] = [];
  if (!query.includeInactive) filters.push(eq(products.isActive, true));
  if (query.q) {
    const term = `%${escapeLike(query.q)}%`;
    filters.push(
      or(
        sql`${products.name} like ${term} escape '\\'`,
        like(products.barcode, `${escapeLike(query.q)}%`),
      )!,
    );
  }
  if (query.categoryId) filters.push(eq(products.categoryId, query.categoryId));
  if (query.brandId) filters.push(eq(products.brandId, query.brandId));
  if (query.stock === "out") filters.push(lte(products.stock, 0));
  if (query.stock === "low") {
    filters.push(lte(products.stock, products.lowStockThreshold));
  }
  const where = filters.length ? and(...filters) : undefined;

  const desc_ = query.sort.startsWith("-");
  const key = query.sort.replace(/^-/, "") as "name" | "stock" | "salePrice" | "createdAt";
  const orderCol = products[key];
  const order = desc_ ? desc(orderCol) : asc(orderCol);

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

export async function getProduct(db: Executor, id: number) {
  const [row] = await baseSelect(db).where(eq(products.id, id));
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

export async function findByBarcode(db: Executor, barcode: string) {
  const [row] = await baseSelect(db).where(
    and(eq(products.barcode, barcode), eq(products.isActive, true)),
  );
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

export async function isBarcodeTaken(db: Executor, barcode: string, exceptId?: number) {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.barcode, barcode));
  return Boolean(row && row.id !== exceptId);
}

/** Returns an internal EAN-13 barcode that is not used by any product yet. */
export async function generateUniqueBarcode(db: Executor) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateInternalEan13();
    if (!(await isBarcodeTaken(db, code))) return code;
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

function mapWriteError(err: unknown): never {
  if (isUniqueViolation(err, "barcode")) throw new AppError("BARCODE_TAKEN");
  if (isUniqueViolation(err)) throw new AppError("NAME_TAKEN");
  throw err;
}

export async function createProduct(db: Database, input: ProductCreateInput, userId: string) {
  assertPrices(input);
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(products)
        .values({ ...input, createdById: userId })
        .returning({ id: products.id });
      if (input.stock > 0) {
        await tx.insert(stockMovements).values({
          productId: row.id,
          change: input.stock,
          stockAfter: input.stock,
          reason: "initial",
          userId,
        });
      }
      return row.id;
    });
    return getProduct(db, id);
  } catch (err) {
    mapWriteError(err);
  }
}

export async function updateProduct(db: Database, id: number, input: ProductUpdateInput) {
  const current = await getProduct(db, id);
  assertPrices({
    costPrice: input.costPrice ?? current.costPrice,
    salePrice: input.salePrice ?? current.salePrice,
  });
  try {
    await db.update(products).set(input).where(eq(products.id, id));
  } catch (err) {
    mapWriteError(err);
  }
  return getProduct(db, id);
}

export async function deleteProduct(db: Executor, id: number) {
  // Past sales keep their snapshot (name, price…) and are unaffected.
  const [row] = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

export async function adjustStock(
  db: Database,
  id: number,
  input: StockAdjustmentInput,
  userId: string,
) {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${input.change}` })
      .where(
        and(
          eq(products.id, id),
          // Never let an adjustment push stock below zero.
          sql`${products.stock} + ${input.change} >= 0`,
        ),
      )
      .returning({ stock: products.stock });
    if (!row) {
      const [exists] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, id));
      throw new AppError(exists ? "INSUFFICIENT_STOCK" : "NOT_FOUND");
    }
    await tx.insert(stockMovements).values({
      productId: id,
      change: input.change,
      stockAfter: row.stock,
      reason: "adjustment",
      note: input.note,
      userId,
    });
  });
  return getProduct(db, id);
}

export async function listStockMovements(db: Executor, productId: number) {
  return db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(100);
}
