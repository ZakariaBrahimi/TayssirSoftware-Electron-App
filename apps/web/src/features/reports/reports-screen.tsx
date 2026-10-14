"use client";

import {
  Banknote,
  BookUser,
  Percent,
  Receipt,
  ShoppingBag,
  Tag,
  TrendingUp,
  Undo2,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMoney } from "@/hooks/use-settings";
import { presetRange, type RangePreset } from "@/lib/dates";
import { useSalesReport } from "./api";
import { RevenueChart } from "./revenue-chart";

export function ReportsScreen() {
  const t = useTranslations("reports");
  const tp = useTranslations("pos");
  const ts = useTranslations("sales");
  const money = useMoney();
  const [preset, setPreset] = useState<RangePreset | "custom">("last30");
  const [range, setRange] = useState(presetRange("last30"));
  const { data, isPending } = useSalesReport(range);
  const s = data?.summary;

  const selectPreset = (value: string) => {
    setPreset(value as RangePreset | "custom");
    if (value !== "custom") setRange(presetRange(value as RangePreset));
  };

  const maxCategory = Math.max(1, ...(data?.byCategory.map((c) => c.revenue) ?? [1]));

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Tabs value={preset} onValueChange={selectPreset}>
          <TabsList>
            <TabsTrigger value="today">{t("today")}</TabsTrigger>
            <TabsTrigger value="last7">{t("last7")}</TabsTrigger>
            <TabsTrigger value="last30">{t("last30")}</TabsTrigger>
            <TabsTrigger value="thisMonth">{t("thisMonth")}</TabsTrigger>
            <TabsTrigger value="custom">{t("custom")}</TabsTrigger>
          </TabsList>
        </Tabs>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
              className="w-40"
            />
            <span className="text-muted-foreground">→</span>
            <Input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
              className="w-40"
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title={t("revenue")}
          icon={Banknote}
          isLoading={isPending}
          value={s && money.format(s.revenue)}
        />
        <StatCard
          title={t("profit")}
          icon={TrendingUp}
          isLoading={isPending}
          value={s && money.format(s.profit)}
        />
        <StatCard
          title={t("margin")}
          icon={Percent}
          isLoading={isPending}
          value={s && `${(s.margin * 100).toFixed(1)} %`}
        />
        <StatCard
          title={t("salesCount")}
          icon={Receipt}
          isLoading={isPending}
          value={s?.salesCount}
        />
        <StatCard
          title={t("itemsSold")}
          icon={ShoppingBag}
          isLoading={isPending}
          value={s?.itemsSold}
        />
        <StatCard
          title={t("avgTicket")}
          icon={Wallet}
          isLoading={isPending}
          value={s && money.format(s.averageTicket)}
        />
        <StatCard
          title={t("cost")}
          icon={Banknote}
          isLoading={isPending}
          value={s && money.format(s.cost)}
        />
        <StatCard
          title={t("discounts")}
          icon={Tag}
          isLoading={isPending}
          value={s && money.format(s.discounts)}
        />
        <StatCard
          title={t("refunds")}
          icon={Undo2}
          isLoading={isPending}
          value={s && money.format(s.refunds)}
          hint={
            s && s.refunds > 0 ? `${t("grossSales")}: ${money.format(s.grossSales)}` : undefined
          }
        />
        <StatCard
          title={t("soldOnCredit")}
          icon={BookUser}
          isLoading={isPending}
          value={s && money.format(s.soldOnCredit)}
          hint={s && `${t("paymentsReceived")}: ${money.format(s.paymentsReceived)}`}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("revenueOverTime")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending || !data ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <RevenueChart data={data.daily} from={range.from} to={range.to} />
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("topProducts")}</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.topProducts.length ? (
              <p className="text-muted-foreground text-sm">{t("noData")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{ts("product")}</TableHead>
                    <TableHead className="text-end">{t("quantity")}</TableHead>
                    <TableHead className="text-end">{t("revenue")}</TableHead>
                    <TableHead className="text-end">{t("profit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProducts.map((p, i) => (
                    <TableRow key={`${p.productId}-${p.name}`}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="max-w-48 truncate font-medium">{p.name}</TableCell>
                      <TableCell className="text-end tabular-nums">{p.quantity}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {money.format(p.revenue)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-end tabular-nums">
                        {money.format(p.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("byCategory")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!data?.byCategory.length ? (
                <p className="text-muted-foreground text-sm">{t("noData")}</p>
              ) : (
                data.byCategory.map((c) => (
                  <div key={c.categoryId ?? "none"} className="grid gap-1">
                    <div className="flex justify-between text-sm">
                      <span>{c.name ?? t("uncategorized")}</span>
                      <span className="tabular-nums">{money.format(c.revenue)}</span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className="bg-chart-1 h-full rounded-full"
                        style={{ width: `${(c.revenue / maxCategory) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("byPayment")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.byPaymentMethod.length ? (
                <p className="text-muted-foreground text-sm">{t("noData")}</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {data.byPaymentMethod.map((p) => (
                    <li key={p.method} className="flex justify-between">
                      <span>
                        {tp(p.method)}{" "}
                        <span className="text-muted-foreground">({p.salesCount})</span>
                      </span>
                      <span className="tabular-nums">{money.format(p.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
