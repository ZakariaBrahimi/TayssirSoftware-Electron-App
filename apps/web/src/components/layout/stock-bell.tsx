"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Link } from "@/i18n/navigation";
import { useStockAlerts } from "@/features/stock/api";
import { DaysLeft, StockStatusBadge } from "@/features/stock/days-left";

/** Header bell: products that are out, low or about to run out. */
export function StockBell() {
  const t = useTranslations("stock");
  const { isAdmin } = useCurrentUser();
  const { data } = useStockAlerts();
  const [open, setOpen] = useState(false);
  const total = data?.summary.total ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("bell", { count: total })}
        >
          <Bell />
          {total > 0 && (
            <span className="bg-destructive absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold text-white tabular-nums">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="font-medium">{t("bellTitle")}</p>
          {data && total > 0 && (
            <p className="text-muted-foreground text-xs">{t("summary", data.summary)}</p>
          )}
        </div>
        {!data ? null : total === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm">{t("allGood")}</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {data.items.slice(0, 8).map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {t("inStock", { count: item.stock })} · <DaysLeft item={item} />
                  </p>
                </div>
                <StockStatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        )}
        {isAdmin && total > 0 && (
          <div className="border-t p-2">
            <Button asChild variant="ghost" className="w-full" onClick={() => setOpen(false)}>
              <Link href="/reorder">{t("openReorder")}</Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
