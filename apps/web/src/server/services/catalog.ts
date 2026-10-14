import { asc, eq, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { brands, categories, products } from "../db/schema";
import { AppError, isUniqueViolation } from "../errors";

type Table = typeof categories | typeof brands;

/** CRUD for simple named lookup tables (categories & brands). */
function namedEntityService(table: Table) {
  const fk = table === categories ? products.categoryId : products.brandId;

  return {
    async list(db: Executor) {
      return db
        .select({
          id: table.id,
          name: table.name,
          productCount: sql<number>`(select count(*) from ${products} where ${fk} = ${table.id})`,
        })
        .from(table)
        .orderBy(asc(table.name));
    },

    async create(db: Executor, name: string) {
      try {
        const [row] = await db.insert(table).values({ name }).returning();
        return row;
      } catch (err) {
        if (isUniqueViolation(err)) throw new AppError("NAME_TAKEN");
        throw err;
      }
    },

    async update(db: Executor, id: number, name: string) {
      try {
        const [row] = await db.update(table).set({ name }).where(eq(table.id, id)).returning();
        if (!row) throw new AppError("NOT_FOUND");
        return row;
      } catch (err) {
        if (isUniqueViolation(err)) throw new AppError("NAME_TAKEN");
        throw err;
      }
    },

    async remove(db: Executor, id: number) {
      // Products referencing it are kept; their foreign key is set to NULL.
      const [row] = await db.delete(table).where(eq(table.id, id)).returning();
      if (!row) throw new AppError("NOT_FOUND");
      return row;
    },
  };
}

export const categoryService = namedEntityService(categories);
export const brandService = namedEntityService(brands);
