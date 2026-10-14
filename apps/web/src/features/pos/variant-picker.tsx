"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoney } from "@/hooks/use-settings";
import { formatQuantity } from "@/lib/quantity";
import { cn } from "@/lib/utils";
import { type Family, useFamily } from "../products/api";
import type { CartProduct } from "./use-cart";

type Variant = Family["variants"][number];

/** Picks the size/colour of a product sold in variants. */
export function VariantPicker({
  familyId,
  onClose,
  onPick,
}: {
  familyId: string | null;
  onClose: () => void;
  onPick: (product: CartProduct) => void;
}) {
  const t = useTranslations("variants");
  const family = useFamily(familyId);
  const data = familyId ? family.data : undefined;
  const variants = data?.variants.filter((v) => v.isActive) ?? [];

  const pick = (v: Variant) =>
    onPick({
      id: v.id,
      name: v.name,
      barcode: v.barcode,
      salePrice: v.salePrice,
      stock: v.stock,
      unit: v.unit,
    });

  return (
    <Dialog open={!!familyId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data?.name ?? t("chooseVariant")}</DialogTitle>
        </DialogHeader>
        {!data ? (
          <Skeleton className="h-40" />
        ) : data.options.length === 2 ? (
          <Matrix family={data} variants={variants} onPick={pick} />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {variants.map((v) => (
              <VariantButton key={v.id} variant={v} label={v.values.join(" / ")} onPick={pick} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Two options: first one in rows, second in columns (size × colour). */
function Matrix({
  family,
  variants,
  onPick,
}: {
  family: Family;
  variants: Variant[];
  onPick: (v: Variant) => void;
}) {
  const [rows, cols] = family.options;
  const find = (a: string, b: string) =>
    variants.find((v) => v.values[0] === a && v.values[1] === b);
  return (
    <div className="-mx-6 overflow-x-auto px-6">
      <table className="w-full border-separate border-spacing-1.5 text-sm">
        <thead>
          <tr>
            <th className="text-muted-foreground text-start text-xs font-medium">
              {rows.name} \ {cols.name}
            </th>
            {cols.values.map((c) => (
              <th key={c} className="text-xs font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.values.map((r) => (
            <tr key={r}>
              <th className="text-start font-medium whitespace-nowrap">{r}</th>
              {cols.values.map((c) => {
                const v = find(r, c);
                return (
                  <td key={c} className="min-w-20">
                    {v ? (
                      <VariantButton variant={v} label={`${r} / ${c}`} onPick={onPick} compact />
                    ) : (
                      <div className="bg-muted/40 h-14 rounded-md" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VariantButton({
  variant,
  label,
  onPick,
  compact,
}: {
  variant: Variant;
  label: string;
  onPick: (v: Variant) => void;
  compact?: boolean;
}) {
  const t = useTranslations("pos");
  const money = useMoney();
  const out = variant.stock <= 0;
  return (
    <button
      type="button"
      disabled={out}
      onClick={() => onPick(variant)}
      aria-label={label}
      className={cn(
        "hover:border-primary hover:bg-accent focus-visible:ring-ring/50 flex w-full flex-col items-center justify-center rounded-md border p-2 text-center transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
        compact ? "h-14" : "h-20",
      )}
    >
      {!compact && <span className="text-sm font-medium">{label}</span>}
      <span className={cn("tabular-nums", compact ? "text-sm font-semibold" : "text-xs")}>
        {out ? t("outOfStock") : formatQuantity(variant.stock)}
      </span>
      <span className="text-muted-foreground text-[11px] tabular-nums">
        {money.format(variant.salePrice)}
      </span>
    </button>
  );
}
