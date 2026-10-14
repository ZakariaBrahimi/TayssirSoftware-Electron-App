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
import { hasAtMost3Decimals, lineAmount, UNIT_SYMBOLS, type Unit } from "@/lib/quantity";
import type { CartProduct } from "./use-cart";

/** Asks the weight (or length, volume) of a measured product. */
export function WeightDialog({
  product,
  onClose,
  onConfirm,
}: {
  product: CartProduct | null;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}) {
  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {product && <WeightForm product={product} onClose={onClose} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function WeightForm({
  product,
  onClose,
  onConfirm,
}: {
  product: CartProduct;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}) {
  const t = useTranslations("pos");
  const tc = useTranslations("common");
  const money = useMoney();
  const [raw, setRaw] = useState("");
  const symbol = UNIT_SYMBOLS[(product.unit ?? "kg") as Unit];
  const value = Number(raw.replace(",", "."));
  const valid = raw !== "" && Number.isFinite(value) && value > 0 && hasAtMost3Decimals(value);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onConfirm(value);
      }}
    >
      <DialogHeader>
        <DialogTitle>{product.name}</DialogTitle>
        <DialogDescription>
          {money.format(product.salePrice)} / {symbol}
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          inputMode="decimal"
          aria-label={t("weight", { unit: symbol })}
          placeholder={product.unit === "g" ? "250" : "0.750"}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="h-12 text-center text-2xl tabular-nums"
        />
        <span className="text-muted-foreground text-lg">{symbol}</span>
      </div>
      <p className="text-center text-lg font-semibold tabular-nums">
        {valid ? money.format(lineAmount(product.salePrice, value)) : "—"}
      </p>
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
