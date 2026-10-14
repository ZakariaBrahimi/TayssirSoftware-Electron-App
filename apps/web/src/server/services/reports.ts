import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { z } from "zod";
import type { reportQuery } from "@/lib/validators";
import type { Ctx } from "../context";
import type { Executor } from "../db/client";
import {
  categories,
  customerPayments,
  products,
  returnItems,
  saleItems,
  saleReturns,
  sales,
} from "../db/schema";
import { col } from "../db/sql";
import { customerBalanceSql } from "./customers";
import { customers } from "../db/schema";

type Query = z.output<typeof reportQuery>;

const n = (v: unknown) => Number(v ?? 0);

/**
 * Sales report for a period. Figures are net of returns: refunds are
 * deducted from revenue on the day they happen, and the cost of items put
 * back in stock is deducted from the cost of goods sold.
 */
export async function salesReport(db: Executor, ctx: Ctx, query: Query) {
  const from = new Date(query.from);
  const to = new Date(query.to);
  const salesInRange = and(
    eq(sales.storeId, ctx.storeId),
    eq(sales.status, "completed"),
    gte(sales.createdAt, from),
    lte(sales.createdAt, to),
  );
  const returnsInRange = and(
    eq(saleReturns.storeId, ctx.storeId),
    gte(saleReturns.createdAt, from),
    lte(saleReturns.createdAt, to),
  );
  // Bucket by the client's local calendar day (timestamps are in ms).
  const offsetSeconds = query.tzOffset * 60;
  const dayOf = (col: unknown) =>
    sql<string>`strftime('%Y-%m-%d', ${col} / 1000 + ${offsetSeconds}, 'unixepoch')`;

  const [totals] = await db
    .select({
      gross: sql<number>`coalesce(sum(${sales.total}), 0)`,
      cost: sql<number>`coalesce(sum(${sales.totalCost}), 0)`,
      discounts: sql<number>`coalesce(sum(${sales.discount}), 0)`,
      onCredit: sql<number>`coalesce(sum(${sales.balanceDue}), 0)`,
      salesCount: sql<number>`count(*)`,
    })
    .from(sales)
    .where(salesInRange);

  const [refundTotals] = await db
    .select({
      refunds: sql<number>`coalesce(sum(${saleReturns.refundAmount}), 0)`,
      restockedCost: sql<number>`coalesce(sum(${saleReturns.restockedCost}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(saleReturns)
    .where(returnsInRange);

  const [{ itemsSold }] = await db
    .select({ itemsSold: sql<number>`coalesce(sum(${saleItems.quantity}), 0)` })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(salesInRange);

  const [{ received }] = await db
    .select({ received: sql<number>`coalesce(sum(${customerPayments.amount}), 0)` })
    .from(customerPayments)
    .where(
      and(
        eq(customerPayments.storeId, ctx.storeId),
        gte(customerPayments.createdAt, from),
        lte(customerPayments.createdAt, to),
      ),
    );

  const saleDay = dayOf(sales.createdAt);
  const dailySales = await db
    .select({
      date: saleDay,
      revenue: sql<number>`sum(${sales.total})`,
      cost: sql<number>`sum(${sales.totalCost})`,
      salesCount: sql<number>`count(*)`,
    })
    .from(sales)
    .where(salesInRange)
    .groupBy(saleDay);

  const returnDay = dayOf(saleReturns.createdAt);
  const dailyReturns = await db
    .select({
      date: returnDay,
      refunds: sql<number>`sum(${saleReturns.refundAmount})`,
      restockedCost: sql<number>`sum(${saleReturns.restockedCost})`,
    })
    .from(saleReturns)
    .where(returnsInRange)
    .groupBy(returnDay);

  const days = new Map<string, { revenue: number; cost: number; salesCount: number }>();
  for (const d of dailySales) {
    days.set(d.date, { revenue: n(d.revenue), cost: n(d.cost), salesCount: n(d.salesCount) });
  }
  for (const r of dailyReturns) {
    const d = days.get(r.date) ?? { revenue: 0, cost: 0, salesCount: 0 };
    d.revenue -= n(r.refunds);
    d.cost -= n(r.restockedCost);
    days.set(r.date, d);
  }

  // Item-level figures net of the refunds made on each sale line.
  const returnedQty = sql<number>`coalesce((select sum(${returnItems.quantity}) from ${returnItems} where ${returnItems.saleItemId} = ${col("sale_items", "id")}), 0)`;
  const returnedAmount = sql<number>`coalesce((select sum(${returnItems.refundAmount}) from ${returnItems} where ${returnItems.saleItemId} = ${col("sale_items", "id")}), 0)`;
  const netQty = sql<number>`sum(${saleItems.quantity} - ${returnedQty})`;
  const netRevenue = sql<number>`sum(${saleItems.lineTotal} - ${returnedAmount})`;
  const netCost = sql<number>`sum(${saleItems.unitCost} * (${saleItems.quantity} - ${returnedQty}))`;

  const topProducts = await db
    .select({
      productId: saleItems.productId,
      name: saleItems.productName,
      quantity: netQty,
      revenue: netRevenue,
      cost: netCost,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(salesInRange)
    .groupBy(saleItems.productId, saleItems.productName)
    .orderBy(desc(netRevenue))
    .limit(10);

  const byCategory = await db
    .select({
      categoryId: categories.id,
      name: categories.name,
      revenue: netRevenue,
      quantity: netQty,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .leftJoin(products, eq(saleItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(salesInRange)
    .groupBy(categories.id, categories.name)
    .orderBy(desc(netRevenue));

  const byPaymentMethod = await db
    .select({
      method: sales.paymentMethod,
      revenue: sql<number>`sum(${sales.total})`,
      salesCount: sql<number>`count(*)`,
    })
    .from(sales)
    .where(salesInRange)
    .groupBy(sales.paymentMethod);

  const revenue = n(totals.gross) - n(refundTotals.refunds);
  const cost = n(totals.cost) - n(refundTotals.restockedCost);
  const salesCount = n(totals.salesCount);

  return {
    summary: {
      revenue,
      grossSales: n(totals.gross),
      refunds: n(refundTotals.refunds),
      returnsCount: n(refundTotals.count),
      cost,
      profit: revenue - cost,
      margin: revenue > 0 ? (revenue - cost) / revenue : 0,
      discounts: n(totals.discounts),
      salesCount,
      itemsSold: n(itemsSold),
      averageTicket: salesCount > 0 ? Math.round(n(totals.gross) / salesCount) : 0,
      soldOnCredit: n(totals.onCredit),
      paymentsReceived: n(received),
    },
    daily: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        revenue: d.revenue,
        profit: d.revenue - d.cost,
        salesCount: d.salesCount,
      })),
    topProducts: topProducts.map((p) => ({
      ...p,
      quantity: n(p.quantity),
      revenue: n(p.revenue),
      profit: n(p.revenue) - n(p.cost),
    })),
    byCategory: byCategory.map((c) => ({ ...c, revenue: n(c.revenue), quantity: n(c.quantity) })),
    byPaymentMethod: byPaymentMethod.map((p) => ({
      ...p,
      revenue: n(p.revenue),
      salesCount: n(p.salesCount),
    })),
  };
}

export type SalesReport = Awaited<ReturnType<typeof salesReport>>;

export async function inventoryOverview(db: Executor, ctx: Ctx) {
  const live = and(
    eq(products.storeId, ctx.storeId),
    eq(products.isActive, true),
    isNull(products.deletedAt),
  );
  const [totals] = await db
    .select({
      productCount: sql<number>`count(*)`,
      stockValueCost: sql<number>`coalesce(sum(${products.costPrice} * max(${products.stock}, 0)), 0)`,
      stockValueRetail: sql<number>`coalesce(sum(${products.salePrice} * max(${products.stock}, 0)), 0)`,
      lowStockCount: sql<number>`sum(case when ${products.stock} > 0 and ${products.stock} <= ${products.lowStockThreshold} then 1 else 0 end)`,
      outOfStockCount: sql<number>`sum(case when ${products.stock} <= 0 then 1 else 0 end)`,
    })
    .from(products)
    .where(live);

  const lowStock = await db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stock,
      lowStockThreshold: products.lowStockThreshold,
    })
    .from(products)
    .where(and(live, lte(products.stock, products.lowStockThreshold)))
    .orderBy(products.stock, products.name)
    .limit(8);

  const [{ receivables }] = await db
    .select({ receivables: sql<number>`coalesce(sum(${customerBalanceSql}), 0)` })
    .from(customers)
    .where(and(eq(customers.storeId, ctx.storeId), isNull(customers.deletedAt)));

  return {
    productCount: n(totals.productCount),
    stockValueCost: n(totals.stockValueCost),
    stockValueRetail: n(totals.stockValueRetail),
    lowStockCount: n(totals.lowStockCount),
    outOfStockCount: n(totals.outOfStockCount),
    receivables: n(receivables),
    lowStock,
  };
}
