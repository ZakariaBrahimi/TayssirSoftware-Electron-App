"use client";

import { eachDayOfInterval, format, parseISO } from "date-fns";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMoney } from "@/hooks/use-settings";
import type { SalesReport } from "./api";

/** Revenue & profit per day, with missing days filled with zeros. */
export function RevenueChart({
  data,
  from,
  to,
  height = 280,
}: {
  data: SalesReport["daily"];
  from: string;
  to: string;
  height?: number;
}) {
  const t = useTranslations("reports");
  const money = useMoney();
  const fmt = useFormatter();

  const series = useMemo(() => {
    const byDate = new Map(data.map((d) => [d.date, d]));
    return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const row = byDate.get(key);
      return {
        date: key,
        revenue: money.toMajor(row?.revenue ?? 0),
        profit: money.toMajor(row?.profit ?? 0),
      };
    });
  }, [data, from, to, money]);

  const labelDate = (v: string) => fmt.dateTime(parseISO(v), { month: "short", day: "numeric" });

  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={labelDate}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v: number) => fmt.number(v, { notation: "compact" })}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
            labelFormatter={(v) => labelDate(String(v))}
            formatter={(value, name) => [
              money.format(money.toMinor(Number(value))),
              name === "revenue" ? t("revenue") : t("profit"),
            ]}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--chart-1)"
            fill="url(#fillRevenue)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="profit"
            stroke="var(--chart-2)"
            fill="url(#fillProfit)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
