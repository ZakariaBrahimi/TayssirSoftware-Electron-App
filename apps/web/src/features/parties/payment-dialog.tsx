"use client";

import { Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMoney } from "@/hooks/use-settings";
import type { PaymentInput } from "@/lib/validators";

type Method = "cash" | "card" | "other";

/** Records a payment from a customer or to a supplier. */
export function PaymentDialog({
  open,
  onOpenChange,
  title,
  description,
  suggested,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Pre-filled amount (minor units), e.g. the balance. */
  suggested?: number;
  isPending: boolean;
  onSubmit: (input: PaymentInput) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {open && <PaymentForm suggested={suggested} isPending={isPending} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  suggested,
  isPending,
  onSubmit,
}: {
  suggested?: number;
  isPending: boolean;
  onSubmit: (input: PaymentInput) => void;
}) {
  const t = useTranslations("common");
  const money = useMoney();
  const [amount, setAmount] = useState(
    suggested && suggested > 0 ? String(money.toMajor(suggested)) : "",
  );
  const [method, setMethod] = useState<Method>("cash");
  const [note, setNote] = useState("");
  const minor = money.toMinor(Number(amount) || 0);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (minor > 0) onSubmit({ amount: minor, method, note: note.trim() || undefined });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="pay-amount">
          {t("amount")} ({money.currency})
        </Label>
        <Input
          id="pay-amount"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-11 text-lg tabular-nums"
        />
      </div>
      <div className="grid gap-2">
        <Label>{t("method")}</Label>
        <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["cash", "card", "other"] as const).map((m) => (
              <SelectItem key={m} value={m}>
                {t(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pay-note">{t("notes")}</Label>
        <Input
          id="pay-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={minor <= 0 || isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
