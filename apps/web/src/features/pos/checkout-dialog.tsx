"use client";

import { Banknote, CreditCard, Loader2, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useMoney } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import type { PAYMENT_METHODS } from "@/lib/validators";

type Method = (typeof PAYMENT_METHODS)[number];

const methods: { value: Method; icon: typeof Banknote }[] = [
  { value: "cash", icon: Banknote },
  { value: "card", icon: CreditCard },
  { value: "other", icon: Wallet },
];

/** Suggests round banknote amounts above the total (e.g. 1 250 → 1 500, 2 000). */
function quickAmounts(totalMajor: number) {
  const steps = [100, 200, 500, 1000, 2000, 5000];
  const out = new Set<number>();
  for (const step of steps) {
    const v = Math.ceil(totalMajor / step) * step;
    if (v > totalMajor) out.add(v);
    if (out.size >= 4) break;
  }
  return [...out].sort((a, b) => a - b);
}

type CheckoutProps = {
  total: number;
  isPending: boolean;
  onConfirm: (input: { paymentMethod: Method; amountPaid: number; note?: string }) => void;
};

export function CheckoutDialog({
  open,
  onOpenChange,
  ...props
}: CheckoutProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so the form state resets on each checkout. */}
        <CheckoutForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function CheckoutForm({ total, isPending, onConfirm }: CheckoutProps) {
  const t = useTranslations("pos");
  const money = useMoney();
  const [method, setMethod] = useState<Method>("cash");
  const [received, setReceived] = useState("");
  const [note, setNote] = useState("");
  const amountPaid = method === "cash" && received !== "" ? money.toMinor(Number(received)) : total;
  const change = amountPaid - total;
  const valid = method !== "cash" || amountPaid >= total;
  const suggestions = useMemo(() => quickAmounts(money.toMajor(total)), [money, total]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || isPending) return;
    onConfirm({ paymentMethod: method, amountPaid, note: note.trim() || undefined });
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{t("checkout")}</DialogTitle>
        <DialogDescription className="text-foreground text-3xl font-semibold tabular-nums">
          {money.format(total)}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label>{t("paymentMethod")}</Label>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {methods.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={method === value}
              onClick={() => setMethod(value)}
              className={cn(
                "hover:bg-accent flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors",
                method === value && "border-primary bg-primary/5 ring-primary/30 ring-2",
              )}
            >
              <Icon className="size-5" />
              {t(value)}
            </button>
          ))}
        </div>
      </div>

      {method === "cash" && (
        <div className="grid gap-2">
          <Label htmlFor="received">{t("amountReceived")}</Label>
          <Input
            id="received"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            autoFocus
            placeholder={String(money.toMajor(total))}
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            className="h-12 text-lg tabular-nums"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setReceived(String(money.toMajor(total)))}
            >
              {t("exact")}
            </Button>
            {suggestions.map((v) => (
              <Button
                key={v}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReceived(String(v))}
              >
                {money.format(money.toMinor(v))}
              </Button>
            ))}
          </div>
          <div
            className={cn(
              "bg-muted flex items-center justify-between rounded-md px-3 py-2 text-sm",
              !valid && "bg-destructive/10 text-destructive",
            )}
          >
            <span>{t("change")}</span>
            <span className="text-lg font-semibold tabular-nums">
              {money.format(Math.max(0, change))}
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="note">{t("note")}</Label>
        <Textarea
          id="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>

      <DialogFooter>
        <Button type="submit" size="lg" className="w-full" disabled={!valid || isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? t("completing") : t("complete")}
        </Button>
      </DialogFooter>
    </form>
  );
}
