"use client";

import {
  BookOpen,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Store,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { SHOP_TYPES, type ShopType } from "@/lib/shop-types";
import { cn } from "@/lib/utils";

const ICONS: Record<ShopType, LucideIcon> = {
  supermarket: ShoppingBasket,
  fashion: Shirt,
  phones: Smartphone,
  cosmetics: Sparkles,
  hardware: Wrench,
  stationery: BookOpen,
  general: Store,
};

/** Cards to pick the kind of shop (sign-up and first-run setup). */
export function ShopTypePicker({
  value,
  onChange,
}: {
  value: ShopType;
  onChange: (value: ShopType) => void;
}) {
  const t = useTranslations("shopTypes");
  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {SHOP_TYPES.map((type) => {
        const Icon = ICONS[type];
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(type)}
            className={cn(
              "hover:bg-accent focus-visible:ring-ring/50 flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
              selected && "border-primary bg-primary/5 text-primary ring-primary ring-1",
            )}
          >
            <Icon className="size-5" />
            <span className="leading-tight">{t(type)}</span>
          </button>
        );
      })}
    </div>
  );
}
