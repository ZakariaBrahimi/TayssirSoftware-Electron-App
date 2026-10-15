"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney } from "@/hooks/use-settings";
import { isMeasured, round3 } from "@/lib/quantity";
import { lineRefund } from "@/lib/refunds";
import { type Sale, useCreateReturn } from "./api";

type RefundMethod = "cash" | "card" | "other" | "account";

export function ReturnDialog({
  sale,
  open,
  onOpenChange,
}: {
  sale: Sale;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("sales");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("returnTitle", { number: sale.number })}</DialogTitle>
        </DialogHeader>
        {open && <ReturnForm sale={sale} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ReturnForm({ sale, onDone }: { sale: Sale; onDone: () => void }) {
  const t = useTranslations("sales");
  const tc = useTranslations("common");
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const create = useCreateReturn();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<RefundMethod>(
    sale.customerId && sale.balanceDue > 0 ? "account" : "cash",
  );
  const [restock, setRestock] = useState(true);
  const [reason, setReason] = useState("");

  const lines = sale.items.map((item) => {
    const returnable = round3(item.quantity - item.returnedQuantity);
    const qty = Math.min(returnable, Math.max(0, quantities[item.id] ?? 0));
    return {
      item,
      returnable,
      qty,
      refund: qty ? lineRefund(item, sale, item.returnedQuantity, qty) : 0,
    };
  });
  const total = lines.reduce((s, l) => s + l.refund, 0);
  const selected = lines.filter((l) => l.qty > 0);
  const methods: RefundMethod[] = sale.customerId
    ? ["cash", "card", "other", "account"]
    : ["cash", "card", "other"];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected.length) return toast.error(t("nothingToReturn"));
    create.mutate(
      {
        saleId: sale.id,
        json: {
          items: selected.map((l) => ({ saleItemId: l.item.id, quantity: l.qty })),
          refundMethod: method,
          restock,
          reason: reason.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success(t("returnCreated"));
          onDone();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <ul className="divide-y rounded-lg border text-sm">
        {lines.map(({ item, returnable, qty, refund }) => (
          <li key={item.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.productName}</p>
              <p className="text-muted-foreground text-xs">
                {t("returnable", { count: returnable })}
                {item.returnedQuantity > 0 &&
                  ` · ${t("returned", { count: item.returnedQuantity })}`}
              </p>
            </div>
            <Input
              type="number"
              inputMode={isMeasured(item.unit) ? "decimal" : "numeric"}
              step={isMeasured(item.unit) ? "any" : 1}
              min={0}
              max={returnable}
              disabled={returnable === 0}
              value={qty || ""}
              placeholder="0"
              onChange={(e) =>
                setQuantities((q) => ({
                  ...q,
                  [item.id]: isMeasured(item.unit)
                    ? round3(Number(e.target.value) || 0)
                    : Math.floor(Number(e.target.value) || 0),
                }))
              }
              className="h-8 w-20 text-center tabular-nums"
              aria-label={item.productName}
            />
            <span className="w-24 text-end tabular-nums">{refund ? money.format(refund) : ""}</span>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("refundMethod")}</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as RefundMethod)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {methods.map((m) => (
                <SelectItem key={m} value={m}>
                  {tc(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <Label htmlFor="restock">{t("restock")}</Label>
            <p className="text-muted-foreground text-xs">{t("restockHint")}</p>
          </div>
          <Switch id="restock" checked={restock} onCheckedChange={setRestock} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="reason">{t("returnReason")}</Label>
        <Input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
      </div>
      <DialogFooter className="items-center">
        <span className="me-auto text-lg font-semibold tabular-nums">
          {t("refundTotal", { amount: money.format(total) })}
        </span>
        <Button type="submit" disabled={!selected.length || create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />}
          {t("returnItems")}
        </Button>
      </DialogFooter>
    </form>
  );
}
