"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  const t = useTranslations("products");
  if (stock <= 0) return <Badge variant="destructive">{t("outOfStock")}</Badge>;
  if (stock <= threshold)
    return (
      <Badge variant="warning" className="tabular-nums">
        {stock} · {t("lowStock")}
      </Badge>
    );
  return (
    <Badge variant="secondary" className="tabular-nums">
      {stock}
    </Badge>
  );
}
