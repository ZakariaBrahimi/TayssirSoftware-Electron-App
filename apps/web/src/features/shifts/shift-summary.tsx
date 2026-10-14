"use client";

import { useTranslations } from "next-intl";
import { useDateFormat, useMoney, useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import type { ShiftSummary } from "./api";

function Line({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4",
        strong && "font-semibold",
        muted && "text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Figures of a shift: sales by method and the cash expected in the drawer. */
export function ShiftFigures({ summary }: { summary: ShiftSummary }) {
  const t = useTranslations("shifts");
  const tc = useTranslations("common");
  const money = useMoney();
  const m = (v: number) => money.format(v);
  const difference = summary.difference;

  return (
    <div className="grid gap-6 text-sm sm:grid-cols-2">
      <div className="grid content-start gap-1.5">
        <h3 className="mb-1 font-medium">{t("byMethod")}</h3>
        {summary.salesByMethod.length === 0 && <p className="text-muted-foreground">—</p>}
        {summary.salesByMethod.map((r) => (
          <Line
            key={r.method}
            label={`${tc(r.method === "credit" ? "credit" : r.method)} (${r.count})`}
            value={m(r.total)}
          />
        ))}
        <Line label={t("sales")} value={m(summary.salesTotal)} strong />
        {summary.voidedCount > 0 && (
          <Line label={t("voidedCount")} value={String(summary.voidedCount)} muted />
        )}
      </div>
      <div className="grid content-start gap-1.5">
        <h3 className="mb-1 font-medium">{t("cashFlow")}</h3>
        <Line label={t("openingCash")} value={m(summary.shift.openingCash)} />
        <Line label={t("cashFromSales")} value={m(summary.cashFromSales)} />
        {summary.cashPayments > 0 && (
          <Line label={t("cashPayments")} value={m(summary.cashPayments)} />
        )}
        {summary.cashRefunds > 0 && (
          <Line label={t("cashRefunds")} value={`−${m(summary.cashRefunds)}`} />
        )}
        {summary.payIns > 0 && <Line label={t("payIns")} value={m(summary.payIns)} />}
        {summary.payOuts > 0 && <Line label={t("payOuts")} value={`−${m(summary.payOuts)}`} />}
        <Line label={t("expectedCash")} value={m(summary.expectedCash)} strong />
        {summary.shift.countedCash !== null && (
          <>
            <Line label={t("countedCash")} value={m(summary.shift.countedCash)} />
            {difference !== null && (
              <div
                className={cn(
                  "flex justify-between font-semibold",
                  difference < 0 && "text-destructive",
                  difference > 0 && "text-warning",
                )}
              >
                <span>
                  {t("difference")} (
                  {difference === 0 ? t("balanced") : difference > 0 ? t("over") : t("short")})
                </span>
                <span className="tabular-nums">{m(difference)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Printable Z report (80 mm). */
export function ZReport({ summary }: { summary: ShiftSummary }) {
  const t = useTranslations("shifts");
  const { data: store } = useSettings();
  const dates = useDateFormat();
  const s = summary.shift;
  return (
    <div className="mx-auto w-[72mm] bg-white p-2 font-mono text-[11px] leading-snug text-black">
      <div className="text-center">
        <div className="text-sm font-bold">{store?.name}</div>
        <div className="font-bold">{t("zReport")}</div>
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div>{t("openedBy", { name: s.openedByName ?? "", date: dates.dateTime(s.createdAt) })}</div>
      {s.closedAt && <div>{t("closedAt", { date: dates.dateTime(s.closedAt) })}</div>}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="[&_h3]:font-bold [&>div]:grid-cols-1">
        <ShiftFigures summary={summary} />
      </div>
      {s.note && <div className="mt-2">{s.note}</div>}
    </div>
  );
}
