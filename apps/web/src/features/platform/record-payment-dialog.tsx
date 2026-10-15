"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";
import { PLATFORM_PAYMENT_METHODS, type PlatformPaymentMethod } from "@/lib/validators/platform";
import { useLicenseOptions, usePaymentMutations, usePlatformMoney, useStoreOptions } from "./api";
import { PlanSelect } from "./plan-select";
import { FormDialog, whenOpen } from "./form-dialog";

export type PaymentTarget =
  | { kind: "store"; id: string; label: string; plan?: string }
  | { kind: "license"; id: string; label: string; plan?: string; lifetime?: boolean };

function TargetPicker({
  kind,
  value,
  onChange,
}: {
  kind: "store" | "license";
  value: PaymentTarget | null;
  onChange: (t: PaymentTarget) => void;
}) {
  const t = useTranslations("platform.payments");
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 250);
  const stores = useStoreOptions(q, kind === "store");
  const licenses = useLicenseOptions(q, kind === "license");
  const options =
    kind === "store"
      ? (stores.data ?? []).map((s) => ({
          kind,
          id: s.id,
          label: s.name,
          sub: s.owner ? `@${s.owner} · ${s.plan}` : s.plan,
          plan: s.plan,
        }))
      : (licenses.data ?? []).map((l) => ({
          kind,
          id: l.id,
          label: l.customerName ?? `…${l.keyHint}`,
          sub: `…${l.keyHint} · ${l.plan}`,
          plan: l.plan,
        }));

  return (
    <div className="grid gap-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={kind === "store" ? t("searchStore") : t("searchLicense")}
      />
      <div className="max-h-44 overflow-y-auto rounded-md border">
        {options.length === 0 && (
          <p className="text-muted-foreground p-3 text-sm">{t("noMatch")}</p>
        )}
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange({ kind: o.kind, id: o.id, label: o.label, plan: o.plan })}
            className={cn(
              "hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-start text-sm",
              value?.id === o.id && "bg-muted",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{o.label}</div>
              <div className="text-muted-foreground truncate text-xs" dir="ltr">
                {o.sub}
              </div>
            </div>
            {value?.id === o.id && <Check className="size-4" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Records a payment; renews the store's subscription (or extends the license). */
function RecordPaymentDialogBody({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected store or license; otherwise picked in the dialog. */
  target?: PaymentTarget;
}) {
  const t = useTranslations("platform.payments");
  const tm = useTranslations("platform.methods");
  const errorMessage = useErrorMessage();
  const money = usePlatformMoney();
  const { record } = usePaymentMutations();
  const [kind, setKind] = useState<"store" | "license">(target?.kind ?? "store");
  const [picked, setPicked] = useState<PaymentTarget | null>(target ?? null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PlatformPaymentMethod>("cash");
  const [months, setMonths] = useState(target?.kind === "license" ? "0" : "1");
  const [plan, setPlan] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const amountMinor = money.toMinor(Number(amount));
  const monthsN = Number(months);
  const valid =
    picked !== null &&
    amountMinor > 0 &&
    Number.isInteger(monthsN) &&
    monthsN >= 0 &&
    monthsN <= 60;

  const submit = () =>
    record.mutate(
      {
        ...(picked!.kind === "store" ? { storeId: picked!.id } : { licenseId: picked!.id }),
        amount: amountMinor,
        method,
        months: monthsN,
        plan: plan.trim() || undefined,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("recorded"));
          onOpenChange(false);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("record")}
      description={target ? target.label : t("recordHint")}
      submitLabel={t("record")}
      isPending={record.isPending}
      canSubmit={valid}
      onSubmit={submit}
    >
      {!target && (
        <>
          <Tabs
            value={kind}
            onValueChange={(v) => {
              setKind(v as typeof kind);
              setPicked(null);
              setMonths(v === "license" ? "0" : "1");
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="store">{t("forStore")}</TabsTrigger>
              <TabsTrigger value="license">{t("forLicense")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <TargetPicker kind={kind} value={picked} onChange={setPicked} />
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
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
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus={Boolean(target)}
          />
        </div>
        <div className="grid gap-2">
          <Label>{t("method")}</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as PlatformPaymentMethod)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {tm(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pay-months">{t("months")}</Label>
          <Input
            id="pay-months"
            type="number"
            min={0}
            max={60}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pay-plan">{t("plan")}</Label>
          <PlanSelect id="pay-plan" value={plan} onChange={setPlan} allowEmpty={t("keepPlan")} />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {(picked?.kind ?? kind) === "store"
          ? monthsN > 0
            ? t("renewsStore", { months: monthsN })
            : t("noRenewal")
          : monthsN > 0
            ? t("extendsLicense", { months: monthsN })
            : t("oneOff")}
      </p>
      <div className="grid gap-2">
        <Label htmlFor="pay-ref">{t("reference")}</Label>
        <Input
          id="pay-ref"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={120}
          placeholder={t("referencePlaceholder")}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pay-note">{t("note")}</Label>
        <Input
          id="pay-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
        />
      </div>
    </FormDialog>
  );
}

export const RecordPaymentDialog = whenOpen(RecordPaymentDialogBody);
