"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDateFormat } from "@/hooks/use-settings";
import { useStockMovements } from "./api";

export function StockHistory({ productId }: { productId: string }) {
  const t = useTranslations("products");
  const dates = useDateFormat();
  const { data, isPending } = useStockMovements(productId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("stockHistory")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : !data?.length ? (
          <p className="text-muted-foreground text-sm">—</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex flex-col">
                  <span>{t(`reason_${m.reason}`)}</span>
                  <span className="text-muted-foreground text-xs">
                    {dates.dateTime(m.createdAt)}
                    {m.userName ? ` · ${m.userName}` : ""}
                    {m.note ? ` · ${m.note}` : ""}
                  </span>
                </div>
                <Badge variant={m.change > 0 ? "success" : "destructive"} className="tabular-nums">
                  {m.change > 0 ? `+${m.change}` : m.change}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
