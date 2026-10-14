import { and, eq, inArray, isNull } from "drizzle-orm";
import type { FamilyOptionInput, FamilyOutput } from "@/lib/validators";
import type { Ctx } from "../context";
import type { Database, Executor } from "../db/client";
import { productFamilies, products } from "../db/schema";
import { AppError } from "../errors";
import { generateUniqueBarcode, isBarcodeTaken } from "./products";
import { moveStock } from "./stock";

/*
 * Product families: a product sold in several versions (size, colour...).
 * Every variant is a normal product (own barcode, stock and price), so
 * sales, returns, purchases and stock alerts work on variants unchanged.
 * Variant names repeat the family name ("Air Max — 42 / Black") so receipts
 * and searches read well without knowing about families.
 */

export const variantLabel = (values: string[]) => values.join(" / ");
export const variantName = (family: string, values: string[]) =>
  `${family} — ${variantLabel(values)}`;

export function parseValues(json: string | null): string[] {
  if (!json) return [];
  try {
    const values = JSON.parse(json);
    return Array.isArray(values) ? values.map(String) : [];
  } catch {
    return [];
  }
}

function parseOptions(json: string): FamilyOptionInput[] {
  try {
    const options = JSON.parse(json);
    return Array.isArray(options) ? options : [];
  } catch {
    return [];
  }
}

const liveFamily = (ctx: Pick<Ctx, "storeId">, id: string) =>
  and(
    eq(productFamilies.id, id),
    eq(productFamilies.storeId, ctx.storeId),
    isNull(productFamilies.deletedAt),
  );

const liveVariants = (ctx: Pick<Ctx, "storeId">, familyId: string) =>
  and(
    eq(products.familyId, familyId),
    eq(products.storeId, ctx.storeId),
    isNull(products.deletedAt),
  );

/** A family with its variants, in the order of the option values. */
export async function getFamily(db: Executor, ctx: Pick<Ctx, "storeId">, id: string) {
  const [family] = await db.select().from(productFamilies).where(liveFamily(ctx, id));
  if (!family) throw new AppError("NOT_FOUND");
  const options = parseOptions(family.options);
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      barcode: products.barcode,
      costPrice: products.costPrice,
      salePrice: products.salePrice,
      stock: products.stock,
      lowStockThreshold: products.lowStockThreshold,
      unit: products.unit,
      isActive: products.isActive,
      description: products.description,
      categoryId: products.categoryId,
      brandId: products.brandId,
      variantValues: products.variantValues,
    })
    .from(products)
    .where(liveVariants(ctx, id));

  const rank = (values: string[]) =>
    values.map((v, k) => {
      const i = options[k]?.values.indexOf(v) ?? -1;
      return i < 0 ? 999 : i;
    });
  const variants = rows
    .map(({ variantValues, ...r }) => ({ ...r, values: parseValues(variantValues) }))
    .sort((a, b) => {
      const ra = rank(a.values);
      const rb = rank(b.values);
      for (let k = 0; k < Math.max(ra.length, rb.length); k++) {
        if ((ra[k] ?? 0) !== (rb[k] ?? 0)) return (ra[k] ?? 0) - (rb[k] ?? 0);
      }
      return 0;
    });

  // Shared fields are read from the variants (they are saved on each one).
  const first = variants[0];
  return {
    id: family.id,
    name: family.name,
    options,
    unit: first?.unit ?? "piece",
    description: first?.description ?? null,
    categoryId: first?.categoryId ?? null,
    brandId: first?.brandId ?? null,
    variants: variants.map((v) => ({
      id: v.id,
      name: v.name,
      barcode: v.barcode,
      costPrice: v.costPrice,
      salePrice: v.salePrice,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      unit: v.unit,
      isActive: v.isActive,
      values: v.values,
    })),
  };
}
export type FamilyDTO = Awaited<ReturnType<typeof getFamily>>;

/** Fields every variant of the family shares. */
const sharedFields = (input: FamilyOutput) => ({
  unit: input.unit,
  description: input.description ?? null,
  categoryId: input.categoryId ?? null,
  brandId: input.brandId ?? null,
});

async function checkBarcodes(
  db: Executor,
  ctx: Ctx,
  variants: FamilyOutput["variants"],
  ownIds: Set<string>,
) {
  for (const v of variants) {
    if (!v.barcode) continue;
    // Barcodes may move between variants of the same family.
    const taken = await isBarcodeTaken(db, ctx, v.barcode);
    if (!taken) continue;
    const [owner] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.storeId, ctx.storeId),
          eq(products.barcode, v.barcode),
          isNull(products.deletedAt),
        ),
      );
    if (!owner || !ownIds.has(owner.id)) {
      throw new AppError("BARCODE_TAKEN", undefined, { barcode: v.barcode });
    }
  }
}

async function insertVariant(
  tx: Executor,
  ctx: Ctx,
  familyId: string,
  input: FamilyOutput,
  v: FamilyOutput["variants"][number],
  used: Set<string>,
) {
  // `used` holds the barcodes typed in the form: generated ones avoid them.
  let barcode = v.barcode || "";
  if (!barcode) {
    do barcode = await generateUniqueBarcode(tx, ctx);
    while (used.has(barcode));
    used.add(barcode);
  }
  const [row] = await tx
    .insert(products)
    .values({
      ...sharedFields(input),
      storeId: ctx.storeId,
      familyId,
      variantValues: JSON.stringify(v.values),
      name: variantName(input.name, v.values),
      barcode,
      costPrice: v.costPrice,
      salePrice: v.salePrice,
      lowStockThreshold: v.lowStockThreshold,
      isActive: v.isActive,
      stock: 0,
    })
    .returning({ id: products.id });
  if (v.stock > 0) {
    await moveStock(tx, ctx, { productId: row.id, change: v.stock, reason: "initial" });
  }
}

export async function createFamily(db: Database, ctx: Ctx, input: FamilyOutput) {
  await checkBarcodes(db, ctx, input.variants, new Set());
  const id = await db.transaction(async (tx) => {
    const [family] = await tx
      .insert(productFamilies)
      .values({ storeId: ctx.storeId, name: input.name, options: JSON.stringify(input.options) })
      .returning({ id: productFamilies.id });
    const used = new Set(input.variants.map((v) => v.barcode).filter((b): b is string => !!b));
    for (const v of input.variants) await insertVariant(tx, ctx, family.id, input, v, used);
    return family.id;
  });
  return getFamily(db, ctx, id);
}

/**
 * Saves the family as given: listed variants are updated (with an id) or
 * created (without), variants left out are removed. Stock of existing
 * variants only changes through stock adjustments, sales and purchases.
 */
export async function updateFamily(db: Database, ctx: Ctx, id: string, input: FamilyOutput) {
  const current = await getFamily(db, ctx, id);
  const ownIds = new Set(current.variants.map((v) => v.id));
  for (const v of input.variants) {
    if (v.id && !ownIds.has(v.id)) throw new AppError("NOT_FOUND");
  }
  await checkBarcodes(db, ctx, input.variants, ownIds);

  await db.transaction(async (tx) => {
    await tx
      .update(productFamilies)
      .set({ name: input.name, options: JSON.stringify(input.options) })
      .where(liveFamily(ctx, id));

    const kept = new Set(input.variants.map((v) => v.id).filter(Boolean));
    const removed = current.variants.filter((v) => !kept.has(v.id)).map((v) => v.id);
    if (removed.length) {
      await tx
        .update(products)
        .set({ deletedAt: new Date(), isActive: false })
        .where(and(inArray(products.id, removed), eq(products.storeId, ctx.storeId)));
    }

    // Free the barcodes first so variants can swap them.
    const existing = input.variants.filter((v) => v.id);
    const used = new Set(input.variants.map((v) => v.barcode).filter((b): b is string => !!b));
    for (const v of existing) {
      const old = current.variants.find((c) => c.id === v.id)!;
      used.add(old.barcode);
    }
    for (const v of existing) {
      const old = current.variants.find((c) => c.id === v.id)!;
      await tx
        .update(products)
        .set({
          ...sharedFields(input),
          variantValues: JSON.stringify(v.values),
          name: variantName(input.name, v.values),
          barcode: v.barcode || old.barcode,
          costPrice: v.costPrice,
          salePrice: v.salePrice,
          lowStockThreshold: v.lowStockThreshold,
          isActive: v.isActive,
        })
        .where(and(eq(products.id, v.id!), eq(products.storeId, ctx.storeId)));
    }
    for (const v of input.variants.filter((v) => !v.id)) {
      await insertVariant(tx, ctx, id, input, v, used);
    }
  });
  return getFamily(db, ctx, id);
}

/** Removes the family and its variants (past sales keep their lines). */
export async function deleteFamily(db: Database, ctx: Ctx, id: string) {
  await getFamily(db, ctx, id);
  await db.transaction(async (tx) => {
    const now = new Date();
    await tx.update(productFamilies).set({ deletedAt: now }).where(liveFamily(ctx, id));
    await tx.update(products).set({ deletedAt: now, isActive: false }).where(liveVariants(ctx, id));
  });
  return { id };
}
