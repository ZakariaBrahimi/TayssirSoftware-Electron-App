"use client";

import {
  AlertTriangle,
  Banknote,
  Boxes,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDateFormat, useMoney } from "@/hooks/use-settings";
import { Link } from "@/i18n/navigation";
import { presetRange } from "@/lib/dates";
import { useInventoryOverview, useSalesReport } from "../reports/api";
import { RevenueChart } from "../reports/revenue-chart";
import { useSales } from "../sales/api";
import { SaleDetailSheet } from "../sales/sale-detail";

export function DashboardScreen() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const money = useMoney();
  const dates = useDateFormat();
  const today = useMemo(() => presetRange("today"), []);
  const month = useMemo(() => presetRange("last30"), []);
  const [selected, setSelected] = useState<string | null>(null);

  const todayReport = useSalesReport(today);
  const monthReport = useSalesReport(month);
  const inventory = useInventoryOverview();
  const recent = useSales({ page: 1, pageSize: 6, status: "completed" });
  const s = todayReport.data?.summary;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild>
            <Link href="/pos">
              <ShoppingCart />
              {t("newSale")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        <StatCard
          title={t("todayRevenue")}
          icon={Banknote}
          isLoading={todayReport.isPending}
          value={s && money.format(s.revenue)}
        />
        <StatCard
          title={t("todayProfit")}
          icon={TrendingUp}
          isLoading={todayReport.isPending}
          value={s && money.format(s.profit)}
        />
        <StatCard
          title={t("todaySales")}
          icon={Receipt}
          isLoading={todayReport.isPending}
          value={s?.salesCount}
        />
        <StatCard
          title={t("inventoryValue")}
          icon={Boxes}
          isLoading={inventory.isPending}
          value={inventory.data && money.format(inventory.data.stockValueCost)}
          hint={inventory.data && t("productsCount", { count: inventory.data.productCount })}
        />
        {!!inventory.data?.receivables && (
          <StatCard
            title={t("receivables")}
            icon={Users}
            value={money.format(inventory.data.receivables)}
            hint={
              <Link href="/customers" className="underline-offset-2 hover:underline">
                {tn("customers")}
              </Link>
            }
          />
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("last30Days")}</CardTitle>
          </CardHeader>
          <CardContent>
            {monthReport.data ? (
              <RevenueChart
                data={monthReport.data.daily}
                from={month.from}
                to={month.to}
                height={260}
              />
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="text-warning size-4" />
              {t("lowStock")}
              {!!inventory.data?.lowStockCount && (
                <Badge variant="warning">
                  {inventory.data.lowStockCount + inventory.data.outOfStockCount}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inventory.isPending ? (
              <Skeleton className="h-40 w-full" />
            ) : !inventory.data?.lowStock.length ? (
              <p className="text-muted-foreground text-sm">{t("lowStockEmpty")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {inventory.data.lowStock.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/products/${p.id}`}
                      className="flex items-center justify-between gap-2 py-2 hover:underline"
                    >
                      <span className="truncate">{p.name}</span>
                      <Badge
                        variant={p.stock <= 0 ? "destructive" : "warning"}
                        className="tabular-nums"
                      >
                        {p.stock}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("recentSales")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : !recent.data?.rows.length ? (
            <p className="text-muted-foreground text-sm">{t("recentSalesEmpty")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {recent.data.rows.map((sale) => (
                <li key={sale.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(sale.id)}
                    className="hover:bg-muted/50 flex w-full items-center justify-between gap-3 py-2.5 text-start"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {sale.number} · {tc(sale.paymentMethod)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {dates.dateTime(sale.createdAt)}
                        {sale.cashierName ? ` · ${sale.cashierName}` : ""}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{money.format(sale.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <SaleDetailSheet saleId={selected} onClose={() => setSelected(null)} />
    </>
  );
}
