import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { z } from "zod";
import type { reportQuery } from "@/lib/validators";
import type { Executor } from "../db/client";
import { categories, products, saleItems, sales } from "../db/schema";

type Query = z.output<typeof reportQuery>;

export async function salesReport(db: Executor, query: Query) {
  const from = new Date(query.from);
  const to = new Date(query.to);
  const inRange = and(
    eq(sales.status, "completed"),
    gte(sales.createdAt, from),
    lte(sales.createdAt, to),
  );
  // Bucket by the client's local calendar day.
  const offsetSeconds = query.tzOffset * 60;
  const day = sql<string>`strftime('%Y-%m-%d', ${sales.createdAt} + ${offsetSeconds}, 'unixepoch')`;

  const [totals] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${sales.total}), 0)`,
      cost: sql<number>`coalesce(sum(${sales.totalCost}), 0)`,
      discounts: sql<number>`coalesce(sum(${sales.discount}), 0)`,
      salesCount: sql<number>`count(*)`,
    })
    .from(sales)
    .where(inRange);

  const [{ itemsSold }] = await db
    .select({ itemsSold: sql<number>`coalesce(sum(${saleItems.quantity}), 0)` })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(inRange);

  const daily = await db
    .select({
      date: day,
      revenue: sql<number>`sum(${sales.total})`,
      cost: sql<number>`sum(${sales.totalCost})`,
      salesCount: sql<number>`count(*)`,
    })
    .from(sales)
    .where(inRange)
    .groupBy(day)
    .orderBy(day);

  const qty = sql<number>`sum(${saleItems.quantity})`;
  const topProducts = await db
    .select({
      productId: saleItems.productId,
      name: saleItems.productName,
      quantity: qty,
      revenue: sql<number>`sum(${saleItems.lineTotal})`,
      cost: sql<number>`sum(${saleItems.unitCost} * ${saleItems.quantity})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(inRange)
    .groupBy(saleItems.productId, saleItems.productName)
    .orderBy(desc(sql`sum(${saleItems.lineTotal})`))
    .limit(10);

  const byCategory = await db
    .select({
      categoryId: categories.id,
      name: categories.name,
      revenue: sql<number>`sum(${saleItems.lineTotal})`,
      quantity: qty,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .leftJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(inRange)
    .groupBy(categories.id, categories.name)
    .orderBy(desc(sql`sum(${saleItems.lineTotal})`));

  const byPaymentMethod = await db
    .select({
      method: sales.paymentMethod,
      revenue: sql<number>`sum(${sales.total})`,
      salesCount: sql<number>`count(*)`,
    })
    .from(sales)
    .where(inRange)
    .groupBy(sales.paymentMethod);

  const revenue = Number(totals.revenue);
  const cost = Number(totals.cost);
  const salesCount = Number(totals.salesCount);

  return {
    summary: {
      revenue,
      cost,
      profit: revenue - cost,
      margin: revenue > 0 ? (revenue - cost) / revenue : 0,
      discounts: Number(totals.discounts),
      salesCount,
      itemsSold: Number(itemsSold),
      averageTicket: salesCount > 0 ? Math.round(revenue / salesCount) : 0,
    },
    daily: daily.map((d) => ({
      date: d.date,
      revenue: Number(d.revenue),
      profit: Number(d.revenue) - Number(d.cost),
      salesCount: Number(d.salesCount),
    })),
    topProducts: topProducts.map((p) => ({
      ...p,
      quantity: Number(p.quantity),
      revenue: Number(p.revenue),
      profit: Number(p.revenue) - Number(p.cost),
    })),
    byCategory: byCategory.map((c) => ({
      ...c,
      revenue: Number(c.revenue),
      quantity: Number(c.quantity),
    })),
    byPaymentMethod: byPaymentMethod.map((p) => ({
      ...p,
      revenue: Number(p.revenue),
      salesCount: Number(p.salesCount),
    })),
  };
}

export type SalesReport = Awaited<ReturnType<typeof salesReport>>;

export async function inventoryOverview(db: Executor) {
  const [totals] = await db
    .select({
      productCount: sql<number>`count(*)`,
      stockValueCost: sql<number>`coalesce(sum(${products.costPrice} * max(${products.stock}, 0)), 0)`,
      stockValueRetail: sql<number>`coalesce(sum(${products.salePrice} * max(${products.stock}, 0)), 0)`,
      lowStockCount: sql<number>`sum(case when ${products.stock} > 0 and ${products.stock} <= ${products.lowStockThreshold} then 1 else 0 end)`,
      outOfStockCount: sql<number>`sum(case when ${products.stock} <= 0 then 1 else 0 end)`,
    })
    .from(products)
    .where(eq(products.isActive, true));

  const lowStock = await db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stock,
      lowStockThreshold: products.lowStockThreshold,
    })
    .from(products)
    .where(and(eq(products.isActive, true), lte(products.stock, products.lowStockThreshold)))
    .orderBy(products.stock, products.name)
    .limit(8);

  return {
    productCount: Number(totals.productCount),
    stockValueCost: Number(totals.stockValueCost),
    stockValueRetail: Number(totals.stockValueRetail),
    lowStockCount: Number(totals.lowStockCount ?? 0),
    outOfStockCount: Number(totals.outOfStockCount ?? 0),
    lowStock,
  };
}
