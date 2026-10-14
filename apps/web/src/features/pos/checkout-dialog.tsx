"use client";

import { Banknote, BookUser, CreditCard, Loader2, Wallet } from "lucide-react";
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
import type { PickedCustomer } from "../customers/customer-picker";

type Method = "cash" | "card" | "other" | "credit";

const methodIcons = { cash: Banknote, card: CreditCard, other: Wallet, credit: BookUser } as const;

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
  customer: PickedCustomer | null;
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

function CheckoutForm({ total, customer, isPending, onConfirm }: CheckoutProps) {
  const t = useTranslations("pos");
  const tc = useTranslations("common");
  const money = useMoney();
  const [method, setMethod] = useState<Method>("cash");
  const [received, setReceived] = useState("");
  const [note, setNote] = useState("");

  const methods: Method[] = customer
    ? ["cash", "card", "credit", "other"]
    : ["cash", "card", "other"];
  const takesAmount = method === "cash" || method === "credit";
  const defaultPaid = method === "credit" ? 0 : total;
  const amountPaid = takesAmount && received !== "" ? money.toMinor(Number(received)) : defaultPaid;
  const change = Math.max(0, amountPaid - total);
  const onAccount = Math.max(0, total - amountPaid);
  const balanceAfter = (customer?.balance ?? 0) + onAccount;
  const overLimit =
    customer?.creditLimit != null && onAccount > 0 && balanceAfter > customer.creditLimit;
  // Without a customer, the full amount must be paid.
  const valid = (onAccount === 0 || customer !== null) && !overLimit;
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
        {customer && <p className="text-muted-foreground text-sm">{customer.name}</p>}
      </DialogHeader>

      <div className="grid gap-2">
        <Label>{t("paymentMethod")}</Label>
        <div
          className={cn("grid gap-2", methods.length === 4 ? "grid-cols-4" : "grid-cols-3")}
          role="radiogroup"
        >
          {methods.map((value) => {
            const Icon = methodIcons[value];
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={method === value}
                onClick={() => {
                  setMethod(value);
                  setReceived("");
                }}
                className={cn(
                  "hover:bg-accent flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors",
                  method === value && "border-primary bg-primary/5 ring-primary/30 ring-2",
                )}
              >
                <Icon className="size-5" />
                {value === "credit" ? t("credit") : tc(value)}
              </button>
            );
          })}
        </div>
      </div>

      {takesAmount && (
        <div className="grid gap-2">
          <Label htmlFor="received">
            {method === "credit" ? t("downPayment") : t("amountReceived")}
          </Label>
          <Input
            id="received"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            autoFocus
            placeholder={String(money.toMajor(defaultPaid))}
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            className="h-12 text-lg tabular-nums"
          />
          {method === "cash" && (
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
          )}
          {customer && method === "cash" && (
            <p className="text-muted-foreground text-xs">{t("partialHint")}</p>
          )}
        </div>
      )}

      <div className="bg-muted grid gap-2 rounded-md px-3 py-2 text-sm">
        {change > 0 && (
          <div className="flex items-center justify-between">
            <span>{t("change")}</span>
            <span className="text-lg font-semibold tabular-nums">{money.format(change)}</span>
          </div>
        )}
        {onAccount > 0 && (
          <div className={cn("flex items-center justify-between", !customer && "text-destructive")}>
            <span>{customer ? t("onAccount") : t("creditNeedsCustomer")}</span>
            <span className="text-lg font-semibold tabular-nums">{money.format(onAccount)}</span>
          </div>
        )}
        {customer && onAccount > 0 && (
          <div className={cn("text-xs", overLimit ? "text-destructive" : "text-muted-foreground")}>
            {t("balanceAfter", { amount: money.format(balanceAfter) })}
            {customer.creditLimit != null &&
              ` · ${tc("total")} ≤ ${money.format(customer.creditLimit)}`}
          </div>
        )}
        {change === 0 && onAccount === 0 && (
          <div className="flex items-center justify-between">
            <span>{t("change")}</span>
            <span className="text-lg font-semibold tabular-nums">{money.format(0)}</span>
          </div>
        )}
      </div>

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
