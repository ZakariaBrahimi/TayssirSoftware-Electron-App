"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { StockAlertItem } from "./api";

/** "Out of stock" / "Low" / "Runs out soon" badge. */
export function StockStatusBadge({ status }: { status: StockAlertItem["status"] }) {
  const t = useTranslations("stock");
  if (status === "ok") return null;
  return (
    <Badge variant={status === "out" ? "destructive" : status === "low" ? "warning" : "secondary"}>
      {t(`status_${status}`)}
    </Badge>
  );
}

/** "Runs out today" / "in 3 days" / "no recent sales". */
export function DaysLeft({ item }: { item: Pick<StockAlertItem, "daysLeft" | "stock"> }) {
  const t = useTranslations("stock");
  if (item.stock <= 0) return <span className="text-destructive">{t("empty")}</span>;
  if (item.daysLeft === null) return <span className="text-muted-foreground">{t("noSales")}</span>;
  return (
    <span className={item.daysLeft <= 2 ? "text-destructive font-medium" : undefined}>
      {t("daysLeft", { count: item.daysLeft })}
    </span>
  );
}
