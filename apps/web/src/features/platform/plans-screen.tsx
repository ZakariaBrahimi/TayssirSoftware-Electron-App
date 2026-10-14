"use client";

import { Check, Loader2, Minus, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useErrorMessage } from "@/hooks/use-error-message";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PLAN_FEATURES, type PlanFeature, planInput } from "@/lib/validators/platform";
import { type PlatformPlan, usePlanMutations, usePlans, usePlatformMoney } from "./api";

type Form = {
  code: string;
  nameEn: string;
  nameFr: string;
  nameAr: string;
  descEn: string;
  descFr: string;
  descAr: string;
  monthlyPrice: string;
  yearlyPrice: string;
  licensePrice: string;
  maxDevices: string;
  maxUsers: string;
  features: PlanFeature[];
  recommended: boolean;
  sortOrder: string;
  active: boolean;
};

const str = (n: number | null) => (n === null ? "" : String(n));
const num = (v: string) => (v.trim() === "" ? null : Number(v));

const toForm = (p?: PlatformPlan): Form => ({
  code: p?.code ?? "",
  nameEn: p?.nameEn ?? "",
  nameFr: p?.nameFr ?? "",
  nameAr: p?.nameAr ?? "",
  descEn: p?.descEn ?? "",
  descFr: p?.descFr ?? "",
  descAr: p?.descAr ?? "",
  monthlyPrice: str(p?.monthlyPrice ?? null),
  yearlyPrice: str(p?.yearlyPrice ?? null),
  licensePrice: str(p?.licensePrice ?? null),
  maxDevices: str(p ? p.maxDevices : 1),
  maxUsers: str(p ? p.maxUsers : 2),
  features: (p?.features as PlanFeature[]) ?? [],
  recommended: p?.recommended ?? false,
  sortOrder: String(p?.sortOrder ?? 30),
  active: p?.active ?? true,
});

function PlanDialog({ plan, onClose }: { plan: PlatformPlan | null; onClose: () => void }) {
  const t = useTranslations("platform.plans");
  const tp = useTranslations("plan");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { create, update } = usePlanMutations();
  const [form, setForm] = useState<Form>(() => toForm(plan ?? undefined));
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const isNew = !plan;
  const pending = create.isPending || update.isPending;
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = planInput.safeParse({
      ...form,
      monthlyPrice: num(form.monthlyPrice),
      yearlyPrice: num(form.yearlyPrice),
      licensePrice: num(form.licensePrice),
      maxDevices: num(form.maxDevices),
      maxUsers: num(form.maxUsers),
      sortOrder: Number(form.sortOrder || 0),
      code: isNew ? form.code : "keep",
    });
    if (!parsed.success) {
      setInvalid(new Set(parsed.error.issues.map((i) => String(i.path[0]))));
      toast.error(t("checkFields"));
      return;
    }
    setInvalid(new Set());
    const done = {
      onSuccess: () => {
        toast.success(t("saved"));
        onClose();
      },
      onError: (err: Error) =>
        toast.error(
          err instanceof ApiError && err.code === "NAME_TAKEN" ? t("codeTaken") : errorMessage(err),
        ),
    };
    if (isNew) {
      create.mutate(parsed.data, done);
    } else {
      const { code, ...json } = parsed.data;
      void code;
      update.mutate({ code: plan.code, json }, done);
    }
  };

  const field = (
    key: keyof Form,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={`plan-${key}`}>{label}</Label>
      <Input
        id={`plan-${key}`}
        value={form[key] as string}
        onChange={set(key)}
        aria-invalid={invalid.has(key) || undefined}
        {...props}
      />
    </div>
  );
  const numberProps = { type: "number", inputMode: "numeric", min: 0, step: 1 } as const;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{isNew ? t("new") : t("editTitle", { code: plan.code })}</DialogTitle>
            <DialogDescription>{t("dialogHint")}</DialogDescription>
          </DialogHeader>

          {isNew && (
            <div className="grid gap-1.5">
              {field("code", t("code"), { dir: "ltr", placeholder: "premium", autoFocus: true })}
              <p className="text-muted-foreground text-xs">{t("codeHint")}</p>
            </div>
          )}

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">{t("names")}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {field("nameEn", "English")}
              {field("nameFr", "Français")}
              {field("nameAr", "العربية", { dir: "rtl" })}
              {field("descEn", t("descIn", { lang: "EN" }))}
              {field("descFr", t("descIn", { lang: "FR" }))}
              {field("descAr", t("descIn", { lang: "AR" }), { dir: "rtl" })}
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">{t("prices")}</legend>
            <p className="text-muted-foreground text-xs">{t("pricesHint")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {field("monthlyPrice", t("monthly"), { ...numberProps, placeholder: t("notSold") })}
              {field("yearlyPrice", t("yearly"), { ...numberProps, placeholder: t("notSold") })}
              {field("licensePrice", t("license"), { ...numberProps, placeholder: t("notSold") })}
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">{t("limits")}</legend>
            <p className="text-muted-foreground text-xs">{t("limitsHint")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {field("maxDevices", t("maxDevices"), { ...numberProps, min: 1, placeholder: "∞" })}
              {field("maxUsers", t("maxUsers"), { ...numberProps, min: 1, placeholder: "∞" })}
              {field("sortOrder", t("sortOrder"), numberProps)}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t("features")}</legend>
            {PLAN_FEATURES.map((f) => (
              <label key={f} className="flex items-center justify-between gap-3 text-sm">
                {tp(`feature_${f}`)}
                <Switch
                  checked={form.features.includes(f)}
                  onCheckedChange={(on) =>
                    setForm((s) => ({
                      ...s,
                      features: on ? [...s.features, f] : s.features.filter((x) => x !== f),
                    }))
                  }
                />
              </label>
            ))}
          </fieldset>

          <div className="grid gap-2 border-t pt-4">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                {t("recommended")}
                <span className="text-muted-foreground block text-xs">{t("recommendedHint")}</span>
              </span>
              <Switch
                checked={form.recommended}
                onCheckedChange={(recommended) => setForm((s) => ({ ...s, recommended }))}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                {t("active")}
                <span className="text-muted-foreground block text-xs">{t("activeHint")}</span>
              </span>
              <Switch
                checked={form.active}
                onCheckedChange={(active) => setForm((s) => ({ ...s, active }))}
              />
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlanCard({ plan, onEdit }: { plan: PlatformPlan; onEdit: () => void }) {
  const t = useTranslations("platform.plans");
  const tp = useTranslations("plan");
  const money = usePlatformMoney();
  const price = (v: number | null) =>
    v === null ? (
      <span className="text-muted-foreground">{t("notSold")}</span>
    ) : (
      <span className="font-medium tabular-nums">{money.format(money.toMinor(v))}</span>
    );
  return (
    <div
      className={cn(
        "bg-card grid content-start gap-4 rounded-xl border p-5",
        !plan.active && "opacity-60",
        plan.recommended && plan.active && "border-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">{plan.nameEn}</h3>
          <p className="text-muted-foreground text-xs">
            <span className="font-mono">{plan.code}</span> · {plan.nameFr} · {plan.nameAr}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {plan.recommended && <Badge>{t("recommended")}</Badge>}
          {!plan.active && <Badge variant="outline">{t("hidden")}</Badge>}
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("monthly")}</dt>
        <dd className="text-end">{price(plan.monthlyPrice)}</dd>
        <dt className="text-muted-foreground">{t("yearly")}</dt>
        <dd className="text-end">{price(plan.yearlyPrice)}</dd>
        <dt className="text-muted-foreground">{t("license")}</dt>
        <dd className="text-end">{price(plan.licensePrice)}</dd>
      </dl>
      <ul className="grid gap-1 text-sm">
        <li className="flex gap-2">
          <Check className="text-primary mt-0.5 size-4 shrink-0" />
          {plan.maxDevices === null
            ? tp("devicesUnlimited")
            : tp("devices", { count: plan.maxDevices })}
        </li>
        <li className="flex gap-2">
          <Check className="text-primary mt-0.5 size-4 shrink-0" />
          {plan.maxUsers === null ? tp("usersUnlimited") : tp("users", { count: plan.maxUsers })}
        </li>
        {PLAN_FEATURES.map((f) => {
          const has = (plan.features as string[]).includes(f);
          return (
            <li key={f} className={cn("flex gap-2", !has && "text-muted-foreground")}>
              {has ? (
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
              ) : (
                <Minus className="mt-0.5 size-4 shrink-0" />
              )}
              {tp(`feature_${f}`)}
            </li>
          );
        })}
      </ul>
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil />
        {t("edit")}
      </Button>
    </div>
  );
}

export function PlansScreen() {
  const t = useTranslations("platform.plans");
  const plans = usePlans();
  const [editing, setEditing] = useState<PlatformPlan | "new" | null>(null);
  const missingPrices = plans.data?.some(
    (p) => p.active && p.monthlyPrice === null && p.yearlyPrice === null && p.licensePrice === null,
  );
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus />
            {t("new")}
          </Button>
        }
      />
      {missingPrices && (
        <p className="bg-warning/15 mb-4 rounded-md px-4 py-3 text-sm">{t("noPriceWarning")}</p>
      )}
      {plans.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.data.map((plan) => (
            <PlanCard key={plan.code} plan={plan} onEdit={() => setEditing(plan)} />
          ))}
        </div>
      ) : (
        <Skeleton className="h-80 w-full" />
      )}
      <p className="text-muted-foreground mt-6 max-w-3xl text-sm">{t("rules")}</p>
      {editing && (
        <PlanDialog plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
