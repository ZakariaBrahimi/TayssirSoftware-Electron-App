import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Ctx } from "../context";
import type { Executor } from "../db/client";
import { brands, categories, products } from "../db/schema";
import { col } from "../db/sql";
import { AppError } from "../errors";

type Table = typeof categories | typeof brands;

/** CRUD for simple named lookup tables (categories & brands). */
function namedEntityService(table: Table) {
  const fk = table === categories ? products.categoryId : products.brandId;
  const live = (ctx: Ctx) => and(eq(table.storeId, ctx.storeId), isNull(table.deletedAt));

  async function assertNameFree(db: Executor, ctx: Ctx, name: string, exceptId?: string) {
    const [row] = await db
      .select({ id: table.id })
      .from(table)
      .where(
        and(
          live(ctx),
          sql`lower(${table.name}) = lower(${name})`,
          exceptId ? ne(table.id, exceptId) : undefined,
        ),
      );
    if (row) throw new AppError("NAME_TAKEN");
  }

  return {
    async list(db: Executor, ctx: Ctx) {
      return db
        .select({
          id: table.id,
          name: table.name,
          productCount: sql<number>`(select count(*) from ${products} where ${fk} = ${col(table === categories ? "categories" : "brands", "id")} and ${products.deletedAt} is null)`,
        })
        .from(table)
        .where(live(ctx))
        .orderBy(asc(table.name));
    },

    /** Finds an entry by name (case-insensitive) or creates it. */
    async findOrCreate(db: Executor, ctx: Ctx, name: string) {
      const [row] = await db
        .select({ id: table.id })
        .from(table)
        .where(and(live(ctx), sql`lower(${table.name}) = lower(${name})`));
      if (row) return row.id;
      const [created] = await db
        .insert(table)
        .values({ storeId: ctx.storeId, name })
        .returning({ id: table.id });
      return created.id;
    },

    async create(db: Executor, ctx: Ctx, name: string) {
      await assertNameFree(db, ctx, name);
      const [row] = await db.insert(table).values({ storeId: ctx.storeId, name }).returning();
      return row;
    },

    async update(db: Executor, ctx: Ctx, id: string, name: string) {
      await assertNameFree(db, ctx, name, id);
      const [row] = await db
        .update(table)
        .set({ name })
        .where(and(eq(table.id, id), live(ctx)))
        .returning();
      if (!row) throw new AppError("NOT_FOUND");
      return row;
    },

    async remove(db: Executor, ctx: Ctx, id: string) {
      const [row] = await db
        .update(table)
        .set({ deletedAt: new Date() })
        .where(and(eq(table.id, id), live(ctx)))
        .returning();
      if (!row) throw new AppError("NOT_FOUND");
      // Products keep existing without the category/brand.
      await db
        .update(products)
        .set({ [fk === products.categoryId ? "categoryId" : "brandId"]: null })
        .where(and(eq(fk, id), eq(products.storeId, ctx.storeId)));
      return row;
    },
  };
}

export const categoryService = namedEntityService(categories);
export const brandService = namedEntityService(brands);
