"use client";

import { Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMoney } from "@/hooks/use-settings";
import { Link } from "@/i18n/navigation";
import type { QuickColor } from "@/lib/quick-keys";
import { cn } from "@/lib/utils";
import { type QuickKeys, useQuickKeys } from "../products/api";

type QuickProduct = QuickKeys["pages"][number]["keys"][number]["product"];

/** Colours of the buttons (full class names, for Tailwind). */
export const QUICK_COLOR_CLASSES: Record<QuickColor, string> = {
  teal: "border-teal-300 bg-teal-50 text-teal-950 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-50",
  sky: "border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-50",
  violet:
    "border-violet-300 bg-violet-50 text-violet-950 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-50",
  rose: "border-rose-300 bg-rose-50 text-rose-950 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-50",
  amber:
    "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50",
  lime: "border-lime-300 bg-lime-50 text-lime-950 hover:bg-lime-100 dark:border-lime-800 dark:bg-lime-950 dark:text-lime-50",
  orange:
    "border-orange-300 bg-orange-50 text-orange-950 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-50",
  slate:
    "border-slate-300 bg-slate-50 text-slate-950 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50",
};

/** The till's quick buttons: one tap adds the product. */
export function QuickKeysPanel({ onPick }: { onPick: (product: QuickProduct) => void }) {
  const t = useTranslations("pos");
  const money = useMoney();
  const { isAdmin } = useCurrentUser();
  const quick = useQuickKeys();
  const [pageIndex, setPageIndex] = useState(0);
  const pages = (quick.data?.pages ?? []).filter((p) => p.keys.length > 0);
  if (!pages.length) return null;
  const page = pages[Math.min(pageIndex, pages.length - 1)];

  return (
    <section aria-label={t("quickKeys")} className="grid gap-2">
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {pages.length > 1 &&
          pages.map((p, i) => (
            <Button
              key={`${p.name}-${i}`}
              size="sm"
              variant={p === page ? "default" : "outline"}
              className="h-8 shrink-0"
              onClick={() => setPageIndex(i)}
            >
              {p.name}
            </Button>
          ))}
        {isAdmin && (
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="text-muted-foreground ms-auto h-8 shrink-0"
          >
            <Link href="/settings?tab=quick">
              <Settings2 />
              {t("editQuickKeys")}
            </Link>
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
        {page.keys.map((k, i) => {
          const p = k.product;
          const out = p.kind !== "service" && p.stock <= 0;
          return (
            <button
              key={`${k.productId}-${i}`}
              type="button"
              disabled={out || !p.isActive}
              onClick={() => onPick(p)}
              className={cn(
                "focus-visible:ring-ring/50 flex h-16 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-2 text-center font-semibold transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
                QUICK_COLOR_CLASSES[k.color],
              )}
            >
              <span className="line-clamp-2 text-sm leading-tight">{k.label || p.name}</span>
              <span className="text-[11px] font-normal tabular-nums opacity-75">
                {p.openPrice && p.salePrice === 0 ? t("priceAtTill") : money.format(p.salePrice)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
