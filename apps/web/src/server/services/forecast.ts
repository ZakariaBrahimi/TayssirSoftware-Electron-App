import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Ctx } from "../context";
import type { Executor } from "../db/client";
import { products, purchaseItems, purchases, stockMovements, stores } from "../db/schema";
import { col } from "../db/sql";
import { AppError } from "../errors";

/*
 * Stock forecasting: how fast each product sells, how many days its stock
 * lasts, and what to reorder. Demand is read from the stock ledger (sales,
 * minus voids and restocked returns) over the last few weeks.
 */

/** Sales history used for the daily rate. */
export const FORECAST_WINDOW_DAYS = 28;
/** Newer products are averaged over their own age, but at least this. */
const MIN_WINDOW_DAYS = 7;
const DAY = 86_400_000;

export type StockStatus = "out" | "low" | "soon" | "ok";

export type ForecastRow = {
  id: string;
  name: string;
  barcode: string;
  stock: number;
  lowStockThreshold: number;
  costPrice: number;
  unit: string;
  /** Units sold per day (0 when nothing sold in the window). */
  dailyRate: number;
  /** Days the stock lasts at that rate; null when it doesn't sell. */
  daysLeft: number | null;
  status: StockStatus;
  /** Units to buy to cover `reorderCoverDays` of sales. */
  suggestedQuantity: number;
  /** Alert level matching `stockAlertDays` of sales; null without sales. */
  suggestedThreshold: number | null;
  /** Supplier and unit cost of the last purchase of this product. */
  supplierId: string | null;
  supplierName: string | null;
  lastCost: number | null;
};

export type ForecastOptions = { alertDays: number; coverDays: number };

/** Pure part of the forecast, shared by the API and the tests. */
export function forecastProduct(
  p: { stock: number; lowStockThreshold: number },
  sold: number,
  windowDays: number,
  opts: ForecastOptions,
) {
  const dailyRate = sold > 0 ? sold / windowDays : 0;
  const stock = Math.max(0, p.stock);
  const daysLeft = dailyRate > 0 ? stock / dailyRate : null;
  const status: StockStatus =
    p.stock <= 0
      ? "out"
      : p.stock <= p.lowStockThreshold
        ? "low"
        : daysLeft !== null && daysLeft <= opts.alertDays
          ? "soon"
          : "ok";
  // Enough for the cover period, and always above the alert level.
  const target = Math.max(Math.ceil(dailyRate * opts.coverDays), p.lowStockThreshold + 1);
  const suggestedQuantity = status === "ok" ? 0 : Math.max(0, target - stock);
  const suggestedThreshold =
    dailyRate > 0 ? Math.max(1, Math.ceil(dailyRate * opts.alertDays)) : null;
  return {
    dailyRate: Math.round(dailyRate * 100) / 100,
    daysLeft: daysLeft === null ? null : Math.floor(daysLeft),
    status,
    suggestedQuantity,
    suggestedThreshold,
  };
}

export async function forecastOptions(db: Executor, storeId: string): Promise<ForecastOptions> {
  const [store] = await db
    .select({ alertDays: stores.stockAlertDays, coverDays: stores.reorderCoverDays })
    .from(stores)
    .where(eq(stores.id, storeId));
  if (!store) throw new AppError("NOT_FOUND");
  return store;
}

/** Forecast for every active product of the store. */
export async function stockForecast(db: Executor, ctx: Pick<Ctx, "storeId">, now = Date.now()) {
  const opts = await forecastOptions(db, ctx.storeId);
  const since = new Date(now - FORECAST_WINDOW_DAYS * DAY);

  const lastPurchase = (field: "supplier_id" | "supplier_name" | "unit_cost") =>
    sql<string | number | null>`(
      select ${field === "unit_cost" ? sql`pi.unit_cost` : sql.raw(`p.${field}`)}
      from ${purchaseItems} pi join ${purchases} p on p.id = pi.purchase_id
      where pi.product_id = ${col("products", "id")}
      order by pi.created_at desc limit 1)`;

  const [rows, demand] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        barcode: products.barcode,
        stock: products.stock,
        lowStockThreshold: products.lowStockThreshold,
        costPrice: products.costPrice,
        unit: products.unit,
        createdAt: products.createdAt,
        supplierId: lastPurchase("supplier_id"),
        supplierName: lastPurchase("supplier_name"),
        lastCost: lastPurchase("unit_cost"),
      })
      .from(products)
      .where(
        and(
          eq(products.storeId, ctx.storeId),
          eq(products.isActive, true),
          isNull(products.deletedAt),
          // Services have no stock to run out of.
          eq(products.kind, "product"),
        ),
      ),
    db
      .select({
        productId: stockMovements.productId,
        // Sales are negative changes; voids and restocked returns give back.
        sold: sql<number>`-sum(${stockMovements.change})`,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.storeId, ctx.storeId),
          inArray(stockMovements.reason, ["sale", "void", "return"]),
          gte(stockMovements.createdAt, since),
        ),
      )
      .groupBy(stockMovements.productId),
  ]);

  const soldBy = new Map(demand.map((d) => [d.productId, Math.max(0, Number(d.sold) || 0)]));
  const items: ForecastRow[] = rows.map((r) => {
    const ageDays = (now - r.createdAt.getTime()) / DAY;
    const windowDays = Math.min(FORECAST_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, ageDays));
    return {
      id: r.id,
      name: r.name,
      barcode: r.barcode,
      stock: r.stock,
      lowStockThreshold: r.lowStockThreshold,
      costPrice: r.costPrice,
      unit: r.unit,
      supplierId: (r.supplierId as string | null) ?? null,
      supplierName: (r.supplierName as string | null) ?? null,
      lastCost: r.lastCost === null ? null : Number(r.lastCost),
      ...forecastProduct(r, soldBy.get(r.id) ?? 0, windowDays, opts),
    };
  });

  const order: Record<StockStatus, number> = { out: 0, low: 1, soon: 2, ok: 3 };
  items.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) ||
      b.dailyRate - a.dailyRate ||
      a.name.localeCompare(b.name),
  );
  return { options: opts, items };
}

/** Products that need attention (out, low or running out soon). */
export async function stockAlerts(db: Executor, ctx: Pick<Ctx, "storeId">, now = Date.now()) {
  const { options, items } = await stockForecast(db, ctx, now);
  const alerts = items.filter((i) => i.status !== "ok");
  const count = (s: StockStatus) => alerts.filter((i) => i.status === s).length;
  return {
    options,
    summary: { out: count("out"), low: count("low"), soon: count("soon"), total: alerts.length },
    items: alerts,
  };
}
export type StockAlerts = Awaited<ReturnType<typeof stockAlerts>>;

/** Sets alert levels in bulk (e.g. the suggested ones). */
export async function setThresholds(
  db: Executor,
  ctx: Pick<Ctx, "storeId">,
  items: { productId: string; threshold: number }[],
) {
  for (const item of items) {
    await db
      .update(products)
      .set({ lowStockThreshold: item.threshold })
      .where(and(eq(products.id, item.productId), eq(products.storeId, ctx.storeId)));
  }
  return { updated: items.length };
}
