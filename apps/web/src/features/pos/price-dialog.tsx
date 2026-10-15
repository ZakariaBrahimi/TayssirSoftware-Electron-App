"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMoney } from "@/hooks/use-settings";
import type { CartProduct } from "./use-cart";

/** Asks the price of an open-price product (a repair, a custom job...). */
export function PriceDialog({
  product,
  onClose,
  onConfirm,
}: {
  product: CartProduct | null;
  onClose: () => void;
  onConfirm: (unitPrice: number) => void;
}) {
  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {product && <PriceForm product={product} onClose={onClose} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function PriceForm({
  product,
  onClose,
  onConfirm,
}: {
  product: CartProduct;
  onClose: () => void;
  onConfirm: (unitPrice: number) => void;
}) {
  const t = useTranslations("pos");
  const tc = useTranslations("common");
  const money = useMoney();
  const [raw, setRaw] = useState(
    product.salePrice > 0 ? String(money.toMajor(product.salePrice)) : "",
  );
  const value = Number(raw.replace(",", ".").replace(/\s/g, ""));
  const valid = raw.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onConfirm(money.toMinor(value));
      }}
    >
      <DialogHeader>
        <DialogTitle>{product.name}</DialogTitle>
        <DialogDescription>{t("typePrice")}</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          onFocus={(e) => e.target.select()}
          inputMode="decimal"
          aria-label={t("price")}
          placeholder="0"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="h-12 text-center text-2xl tabular-nums"
        />
        <span className="text-muted-foreground text-lg">{money.currency}</span>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={!valid}>
          {t("addToCart")}
        </Button>
      </DialogFooter>
    </form>
  );
}
