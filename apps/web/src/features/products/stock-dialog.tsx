"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { useErrorMessage } from "@/hooks/use-error-message";
import { formatWithUnit, hasAtMost3Decimals, isMeasured, round3 } from "@/lib/quantity";
import { useProductMutations } from "./api";

export function StockAdjustDialog({
  product,
  open,
  onOpenChange,
}: {
  product: { id: string; name: string; stock: number; unit?: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { adjustStock } = useProductMutations();
  const [change, setChange] = useState("");
  const [note, setNote] = useState("");
  const measured = isMeasured(product.unit);
  const value = Number(change.replace(",", "."));
  const valid =
    change.trim() !== "" &&
    Number.isFinite(value) &&
    value !== 0 &&
    (measured ? hasAtMost3Decimals(value) : Number.isInteger(value)) &&
    round3(product.stock + value) >= 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    adjustStock.mutate(
      { id: product.id, json: { change: value, note: note || undefined } },
      {
        onSuccess: () => {
          toast.success(t("stockAdjusted"));
          setChange("");
          setNote("");
          onOpenChange(false);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {t("adjustStock")} · {product.name}
            </DialogTitle>
            <DialogDescription>{t("adjustStockDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="stock-change">{t("change")}</Label>
              <Input
                id="stock-change"
                type="number"
                step={measured ? "any" : 1}
                inputMode={measured ? "decimal" : "numeric"}
                placeholder="+10 / -2"
                value={change}
                onChange={(e) => setChange(e.target.value)}
                autoFocus
              />
            </div>
            <div className="text-muted-foreground pb-2 text-sm tabular-nums">
              {formatWithUnit(product.stock, product.unit)} →{" "}
              {formatWithUnit(valid ? round3(product.stock + value) : product.stock, product.unit)}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stock-note">{t("note")}</Label>
            <Input
              id="stock-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={!valid || adjustStock.isPending}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
