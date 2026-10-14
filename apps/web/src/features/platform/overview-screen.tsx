"use client";

import { addDays, format as formatDate, subMonths } from "date-fns";
import {
  Activity,
  Banknote,
  Building2,
  Clock,
  KeyRound,
  MonitorSmartphone,
  Repeat,
} from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { StoreStatus } from "@/lib/validators/platform";
import { type Overview, useOverview, usePlatformMoney } from "./api";
import { RelativeDate, StoreStatusBadge } from "./shared";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

function MiniBarChart({
  data,
  label,
  formatValue,
  formatTick,
}: {
  data: { key: string; value: number }[];
  label: string;
  formatValue: (v: number) => string;
  formatTick: (key: string) => string;
}) {
  const fmt = useFormatter();
  return (
    <div dir="ltr" className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="key"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
            tickFormatter={formatTick}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            allowDecimals={false}
            tickFormatter={(v: number) => fmt.number(v, { notation: "compact" })}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={tooltipStyle}
            labelFormatter={(v) => formatTick(String(v))}
            formatter={(v) => [formatValue(Number(v)), label]}
          />
          <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type AttentionRow = Overview["attention"]["trialsEnding"][number];

function StoreList({
  title,
  rows,
  empty,
  icon: Icon,
}: {
  title: string;
  rows: AttentionRow[];
  empty: string;
  icon: typeof Clock;
}) {
  return (
    <Card className="min-w-0 gap-3">
      <CardHeader className="flex flex-row items-center gap-2">
        <Icon className="text-muted-foreground size-4" />
        <CardTitle className="text-base">{title}</CardTitle>
        <span className="text-muted-foreground ms-auto text-sm tabular-nums">{rows.length}</span>
      </CardHeader>
      <CardContent className="grid gap-1">
        {rows.length === 0 && <p className="text-muted-foreground py-4 text-sm">{empty}</p>}
        {rows.map((s) => (
          <Link
            key={s.id}
            href={`/platform/stores/${s.id}`}
            className="hover:bg-muted -mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{s.name}</div>
              <div className="text-muted-foreground truncate text-xs" dir="ltr">
                {s.owner ? `@${s.owner}` : "—"} · {s.plan}
              </div>
            </div>
            <div className="text-end text-xs">
              <StoreStatusBadge status={s.status as StoreStatus} />
              <div className="text-muted-foreground mt-1">
                <RelativeDate value={s.at} />
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function OverviewScreen() {
  const t = useTranslations("platform.overview");
  const ts = useTranslations("platform.status");
  const tm = useTranslations("platform.methods");
  const money = usePlatformMoney();
  const fmt = useFormatter();
  const now = useNow();
  const { data, isPending } = useOverview();

  const months = useMemo(() => {
    const byMonth = new Map(data?.revenue.byMonth.map((m) => [m.month, m.amount]));
    return Array.from({ length: 12 }, (_, i) => {
      const key = formatDate(subMonths(now, 11 - i), "yyyy-MM");
      return { key, value: money.toMajor(byMonth.get(key) ?? 0) };
    });
  }, [data, now, money]);

  const signups = useMemo(() => {
    const byDay = new Map(data?.signups.map((d) => [d.date, d.stores]));
    const start = addDays(now, -29);
    return Array.from({ length: 30 }, (_, i) => {
      const key = formatDate(addDays(start, i), "yyyy-MM-dd");
      return { key, value: byDay.get(key) ?? 0 };
    });
  }, [data, now]);

  const s = data?.stores;
  const change =
    data && data.revenue.lastMonth > 0
      ? (data.revenue.thisMonth - data.revenue.lastMonth) / data.revenue.lastMonth
      : null;

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("mrr")}
          icon={Repeat}
          isLoading={isPending}
          value={data && money.format(data.revenue.mrr)}
          hint={
            s && s.payingWithoutPayment > 0
              ? t("payingWithoutPayment", { count: s.payingWithoutPayment })
              : t("mrrHint")
          }
        />
        <StatCard
          title={t("revenueThisMonth")}
          icon={Banknote}
          isLoading={isPending}
          value={data && money.format(data.revenue.thisMonth)}
          hint={
            data &&
            (change === null
              ? t("lastMonth", { amount: money.format(data.revenue.lastMonth) })
              : t("vsLastMonth", {
                  change: fmt.number(change, { style: "percent", signDisplay: "always" }),
                }))
          }
        />
        <StatCard
          title={t("payingStores")}
          icon={Building2}
          isLoading={isPending}
          value={s?.paying}
          hint={
            s &&
            t("storesBreakdown", {
              total: s.total,
              trials: s.byStatus.trialing ?? 0,
            })
          }
        />
        <StatCard
          title={t("activeStores")}
          icon={Activity}
          isLoading={isPending}
          value={s?.activeLast7Days}
          hint={t("activeStoresHint")}
        />
        <StatCard
          title={t("licenses")}
          icon={KeyRound}
          isLoading={isPending}
          value={data?.licenses.active}
          hint={data && t("licensesHint", { devices: data.licenses.devices })}
        />
        <StatCard
          title={t("syncedDevices")}
          icon={MonitorSmartphone}
          isLoading={isPending}
          value={data && `${data.devices.active} / ${data.devices.total}`}
          hint={t("syncedDevicesHint")}
        />
        <Card className="gap-2 py-4 sm:col-span-2">
          <CardHeader className="px-4">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {t("byStatus")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-5 gap-y-2 px-4 text-sm">
            {isPending ? (
              <Skeleton className="h-6 w-full" />
            ) : (
              (Object.entries(s?.byStatus ?? {}) as [StoreStatus, number][]).map(([k, v]) => (
                <Link
                  key={k}
                  href={`/platform/stores?status=${k}`}
                  className="hover:text-foreground text-muted-foreground"
                >
                  {ts(k)}: <span className="text-foreground font-semibold tabular-nums">{v}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("revenueByMonth")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <MiniBarChart
                data={months}
                label={t("revenue")}
                formatValue={(v) => money.format(money.toMinor(v))}
                formatTick={(k) => fmt.dateTime(new Date(`${k}-01T00:00:00`), { month: "short" })}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("signups")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <MiniBarChart
                data={signups}
                label={t("newStores")}
                formatValue={(v) => fmt.number(v)}
                formatTick={(k) =>
                  fmt.dateTime(new Date(`${k}T00:00:00`), { month: "short", day: "numeric" })
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">{t("attention")}</h2>
      {isPending || !data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <StoreList
            title={t("trialsEnding")}
            rows={data.attention.trialsEnding}
            empty={t("nothing")}
            icon={Clock}
          />
          <StoreList
            title={t("renewalsDue")}
            rows={data.attention.renewalsDue}
            empty={t("nothing")}
            icon={Repeat}
          />
          <StoreList
            title={t("lapsed")}
            rows={data.attention.lapsed}
            empty={t("nothing")}
            icon={Activity}
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 gap-3">
          <CardHeader className="flex flex-row items-center">
            <CardTitle className="text-base">{t("recentSignups")}</CardTitle>
            <Link href="/platform/stores" className="text-primary ms-auto text-sm hover:underline">
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="grid gap-1">
            {data?.recentStores.length === 0 && (
              <p className="text-muted-foreground py-4 text-sm">{t("nothing")}</p>
            )}
            {data?.recentStores.map((st) => (
              <Link
                key={st.id}
                href={`/platform/stores/${st.id}`}
                className="hover:bg-muted -mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{st.name}</span>
                <StoreStatusBadge status={st.status as StoreStatus} />
                <span className="text-muted-foreground shrink-0 text-end text-xs sm:w-28">
                  <RelativeDate value={st.createdAt} />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card className="min-w-0 gap-3">
          <CardHeader className="flex flex-row items-center">
            <CardTitle className="text-base">{t("recentPayments")}</CardTitle>
            <Link
              href="/platform/payments"
              className="text-primary ms-auto text-sm hover:underline"
            >
              {t("viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="grid gap-1">
            {data?.recentPayments.length === 0 && (
              <p className="text-muted-foreground py-4 text-sm">{t("nothing")}</p>
            )}
            {data?.recentPayments.map((pay) => (
              <div key={pay.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {pay.storeName ?? (pay.licenseId ? t("licenseSale") : "—")}
                </span>
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  {tm(pay.method)}
                </span>
                <span className="shrink-0 text-end font-medium tabular-nums sm:w-32">
                  {money.format(pay.amount)}
                </span>
                <span className="text-muted-foreground hidden w-24 text-end text-xs sm:inline">
                  <RelativeDate value={pay.createdAt} />
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
