"use client";

import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  ImagePlus,
  Loader2,
  Minus,
  MonitorSmartphone,
  Users,
  WifiOff,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useDateFormat } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import {
  type BillingPeriod,
  PLAN_FEATURES,
  PLATFORM_PAYMENT_METHODS,
  type PlatformPaymentMethod,
} from "@/lib/validators/platform";
import {
  type Catalog,
  type CatalogPlan,
  compressImage,
  type Subscription,
  useCatalogMoney,
  usePlanName,
  useSubscription,
  useSubscriptionMutations,
} from "./api";

type Choice = { plan: CatalogPlan; period: BillingPeriod; price: number };

/** Monthly value, to tell an upgrade from a downgrade. */
const monthly = (p: CatalogPlan | undefined) =>
  p ? (p.monthlyPrice ?? (p.yearlyPrice !== null ? p.yearlyPrice / 12 : (p.licensePrice ?? 0))) : 0;

function priceFor(plan: CatalogPlan, period: BillingPeriod) {
  return period === "month"
    ? plan.monthlyPrice
    : period === "year"
      ? plan.yearlyPrice
      : plan.licensePrice;
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const t = useTranslations("subscription");
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <span dir="ltr" className="truncate font-mono font-medium select-all">
          {value}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("copy")}
          onClick={() =>
            navigator.clipboard.writeText(value).then(
              () => toast.success(t("copied")),
              () => {},
            )
          }
        >
          <Copy />
        </Button>
      </span>
    </div>
  );
}

function PayDialog({
  choice,
  catalog,
  current,
  onClose,
}: {
  choice: Choice;
  catalog: Catalog;
  current: CatalogPlan | undefined;
  onClose: () => void;
}) {
  const t = useTranslations("subscription");
  const tm = useTranslations("platform.methods");
  const locale = useLocale() as "en" | "fr" | "ar";
  const errorMessage = useErrorMessage();
  const money = useCatalogMoney(catalog.currency);
  const { send } = useSubscriptionMutations();
  const [method, setMethod] = useState<PlatformPaymentMethod>("ccp");
  const [reference, setReference] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const pay = catalog.payment;
  const change =
    !current || current.code === choice.plan.code
      ? "renew"
      : monthly(choice.plan) >= monthly(current)
        ? "upgrade"
        : "downgrade";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    send.mutate(
      {
        planCode: choice.plan.code,
        period: choice.period,
        method,
        reference,
        note,
        receipt,
        contactName,
        contactPhone,
      },
      {
        onSuccess: () => {
          toast.success(t("requestSent"));
          onClose();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {choice.plan.name[locale] || choice.plan.name.en} · {t(`period_${choice.period}`)}
            </DialogTitle>
            <DialogDescription className="text-foreground font-display text-2xl font-semibold">
              {money.whole(choice.price)}
            </DialogDescription>
          </DialogHeader>
          {choice.period !== "lifetime" && change !== "renew" && (
            <p className="bg-accent rounded-md px-3 py-2 text-sm">{t(`rule_${change}`)}</p>
          )}

          <div className="rounded-lg border px-4 py-2">
            <p className="py-1.5 text-sm font-medium">{t("howToPay")}</p>
            <CopyLine label={t("payee")} value={pay.payeeName} />
            <CopyLine label="CCP" value={pay.ccpAccount} />
            <CopyLine label={t("rip")} value={pay.ripAccount} />
            <CopyLine label={t("rib")} value={pay.bankRib} />
            {pay.note && <p className="text-muted-foreground py-1.5 text-sm">{pay.note}</p>}
            {!pay.ccpAccount && !pay.ripAccount && !pay.bankRib && (
              <p className="text-muted-foreground py-1.5 text-sm">{t("payDetailsMissing")}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t("paidBy")}</Label>
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
              <Label htmlFor="pay-ref">{t("reference")}</Label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-name">{t("contactName")}</Label>
              <Input
                id="pay-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-phone">{t("contactPhone")}</Label>
              <Input
                id="pay-phone"
                dir="ltr"
                inputMode="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                maxLength={40}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pay-receipt">{t("receipt")}</Label>
            {receipt ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receipt} alt="" className="h-20 w-20 rounded-md border object-cover" />
                <Button type="button" variant="outline" size="sm" onClick={() => setReceipt(null)}>
                  {t("removePhoto")}
                </Button>
              </div>
            ) : (
              <label
                htmlFor="pay-receipt"
                className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm"
              >
                {reading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                {t("addPhoto")}
                <input
                  id="pay-receipt"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setReading(true);
                    try {
                      setReceipt(await compressImage(file));
                    } catch {
                      toast.error(t("photoTooLarge"));
                    } finally {
                      setReading(false);
                    }
                  }}
                />
              </label>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-note">{t("note")}</Label>
            <Textarea
              id="pay-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
            />
          </div>
          <p className="text-muted-foreground text-xs">{t("afterSend")}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={send.isPending || reading}>
              {send.isPending && <Loader2 className="animate-spin" />}
              {t("sendRequest")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Usage({
  icon: Icon,
  label,
  used,
  max,
}: {
  icon: typeof Users;
  label: string;
  used: number | null;
  max: number | null;
}) {
  const t = useTranslations("subscription");
  if (used === null) return null;
  const full = max !== null && used >= max;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </span>
        <span className={cn("tabular-nums", full && "text-destructive font-medium")}>
          {max === null ? t("usedUnlimited", { used }) : t("usedOf", { used, max })}
        </span>
      </div>
      {max !== null && (
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full", full ? "bg-destructive" : "bg-primary")}
            style={{ width: `${Math.min(100, (used / max) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function CurrentPlan({ data }: { data: Subscription }) {
  const t = useTranslations("subscription");
  const dates = useDateFormat();
  const planName = usePlanName();
  const ent = data.entitlement;
  const plans = data.catalog?.plans;
  const limits = ent.limits;
  const status = ent.status;
  return (
    <Card>
      <CardHeader>
        <CardDescription>{t(data.kind === "license" ? "yourLicense" : "yourPlan")}</CardDescription>
        <CardTitle className="font-display flex flex-wrap items-center gap-3 text-2xl">
          {status === "trial" ? t("trialName") : planName(plans, ent.plan)}
          <Badge
            variant={
              status === "active" ? "success" : status === "trial" ? "secondary" : "destructive"
            }
          >
            {t(`status_${status}`)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="text-sm">
          {ent.expiresAt ? (
            <span className="flex items-center gap-2">
              <Clock className="text-muted-foreground size-4" />
              {status === "expired"
                ? t("endedOn", { date: dates.date(ent.expiresAt) })
                : t(status === "trial" ? "trialEnds" : "endsOn", {
                    date: dates.date(ent.expiresAt),
                    days: ent.daysLeft ?? 0,
                  })}
            </span>
          ) : (
            status === "active" && <span className="text-muted-foreground">{t("noEnd")}</span>
          )}
          {ent.scheduledPlan && ent.planChangesAt && (
            <p className="text-muted-foreground mt-2">
              {t("scheduled", {
                plan: planName(plans, ent.scheduledPlan),
                date: dates.date(ent.planChangesAt),
              })}
            </p>
          )}
          {!ent.canWrite && (
            <p className="text-destructive mt-2 flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {t("readOnly")}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Usage
            icon={Users}
            label={t("users")}
            used={data.usage.users}
            max={limits?.maxUsers ?? null}
          />
          <Usage
            icon={MonitorSmartphone}
            label={t("devices")}
            used={data.usage.devices}
            max={limits?.maxDevices ?? null}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Requests({ data }: { data: Subscription }) {
  const t = useTranslations("subscription");
  const dates = useDateFormat();
  const planName = usePlanName();
  const money = useCatalogMoney(data.catalog?.currency);
  const errorMessage = useErrorMessage();
  const { cancel } = useSubscriptionMutations();
  if (!data.requests.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("requests")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {data.requests.slice(0, 6).map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {planName(data.catalog?.plans, r.planCode)} · {t(`period_${r.period}`)} ·{" "}
                <span className="tabular-nums">{money.minor(r.amount)}</span>
              </div>
              <div className="text-muted-foreground text-xs">
                {dates.dateTime(r.createdAt)}
                {r.rejectReason && ` · ${r.rejectReason}`}
              </div>
            </div>
            <Badge
              variant={
                r.status === "approved"
                  ? "success"
                  : r.status === "pending"
                    ? "warning"
                    : r.status === "rejected"
                      ? "destructive"
                      : "outline"
              }
            >
              {t(`req_${r.status}`)}
            </Badge>
            {r.status === "pending" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={cancel.isPending}
                onClick={() =>
                  cancel.mutate(r.id, { onError: (err) => toast.error(errorMessage(err)) })
                }
              >
                {t("cancelRequest")}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PlanCard({
  plan,
  period,
  current,
  currency,
  pending,
  owned,
  onChoose,
}: {
  plan: CatalogPlan;
  period: BillingPeriod;
  current: CatalogPlan | undefined;
  currency: string;
  pending: boolean;
  /** A lifetime license: only upgrades make sense. */
  owned: boolean;
  onChoose: (c: Choice) => void;
}) {
  const t = useTranslations("subscription");
  const tp = useTranslations("plan");
  const locale = useLocale() as "en" | "fr" | "ar";
  const money = useCatalogMoney(currency);
  const price = priceFor(plan, period);
  const isCurrent = current?.code === plan.code;
  const action = isCurrent
    ? "renew"
    : !current || monthly(plan) >= monthly(current)
      ? "upgrade"
      : "downgrade";
  return (
    <div
      className={cn(
        "bg-card grid content-start gap-4 rounded-xl border p-5",
        plan.recommended && "border-primary ring-primary/15 ring-4",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold">
            {plan.name[locale] || plan.name.en}
          </h3>
          <p className="text-muted-foreground text-sm">
            {plan.description[locale] || plan.description.en}
          </p>
        </div>
        {isCurrent ? (
          <Badge variant="secondary">{t("current")}</Badge>
        ) : (
          plan.recommended && <Badge>{t("recommended")}</Badge>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        {price !== null ? (
          <>
            <span className="font-display text-3xl font-semibold tabular-nums">
              {money.whole(price)}
            </span>
            <span className="text-muted-foreground text-sm">{t(`per_${period}`)}</span>
          </>
        ) : (
          <span className="font-display text-xl font-semibold">{t("onRequest")}</span>
        )}
      </div>
      <ul className="grid gap-1.5 text-sm">
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
        <li className="flex gap-2">
          <Check className="text-primary mt-0.5 size-4 shrink-0" />
          {tp("base")}
        </li>
        {PLAN_FEATURES.map((f) => {
          const has = plan.features.includes(f);
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
      <Button
        variant={action === "downgrade" ? "outline" : "default"}
        disabled={price === null || pending || (owned && action !== "upgrade")}
        onClick={() => price !== null && onChoose({ plan, period, price })}
      >
        {owned && action !== "upgrade" ? t("included") : t(`action_${action}`)}
      </Button>
    </div>
  );
}

export function SubscriptionScreen() {
  const t = useTranslations("subscription");
  const { data, isPending, error } = useSubscription();
  const errorMessage = useErrorMessage();
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [choice, setChoice] = useState<Choice | null>(null);

  if (isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!data) return <p className="text-muted-foreground">{errorMessage(error)}</p>;

  const catalog = data.catalog;
  const isLicense = data.kind === "license";
  const effectivePeriod: BillingPeriod = isLicense ? "lifetime" : period;
  const current = catalog?.plans.find((p) => p.code === data.entitlement.plan);
  const pending = data.requests.some((r) => r.status === "pending");

  if (data.entitlement.status === "unmanaged") {
    return (
      <>
        <PageHeader title={t("title")} />
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center">
            {t("unmanaged")}
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("title")} description={t(isLicense ? "subtitleLicense" : "subtitle")} />
      <div className="grid gap-4">
        {!data.online && (
          <div className="bg-warning/15 flex items-center gap-2 rounded-md px-4 py-3 text-sm">
            <WifiOff className="size-4 shrink-0" />
            {t("offline")}
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <CurrentPlan data={data} />
          <Requests data={data} />
        </div>

        {catalog && catalog.plans.length > 0 && (
          <section className="mt-4 grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">{t("choose")}</h2>
                <p className="text-muted-foreground text-sm">
                  {pending ? t("pendingHint") : t(isLicense ? "chooseLicenseHint" : "chooseHint")}
                </p>
              </div>
              {!isLicense && (
                <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                  <TabsList>
                    <TabsTrigger value="month">{t("monthly")}</TabsTrigger>
                    <TabsTrigger value="year">{t("yearly")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {catalog.plans.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  period={effectivePeriod}
                  current={data.entitlement.status === "trial" ? undefined : current}
                  currency={catalog.currency}
                  pending={pending}
                  owned={
                    isLicense && data.entitlement.status === "active" && !data.entitlement.expiresAt
                  }
                  onChoose={setChoice}
                />
              ))}
            </div>
          </section>
        )}

        {data.payments.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">{t("history")}</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentHistory data={data} />
            </CardContent>
          </Card>
        )}
      </div>
      {choice && catalog && (
        <PayDialog
          choice={choice}
          catalog={catalog}
          current={current}
          onClose={() => setChoice(null)}
        />
      )}
    </>
  );
}

function PaymentHistory({ data }: { data: Subscription }) {
  const t = useTranslations("subscription");
  const tm = useTranslations("platform.methods");
  const dates = useDateFormat();
  const planName = usePlanName();
  const money = useCatalogMoney(data.catalog?.currency);
  return (
    <div className="divide-y text-sm">
      {data.payments.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-3 py-2">
          <span className="w-28">{dates.date(p.createdAt)}</span>
          <span className="min-w-0 flex-1">
            {planName(data.catalog?.plans, p.plan)}
            {p.periodEnd && (
              <span className="text-muted-foreground">
                {" "}
                · {t("until", { date: dates.date(p.periodEnd) })}
              </span>
            )}
          </span>
          <span className="text-muted-foreground">{tm(p.method)}</span>
          <span className="font-medium tabular-nums">{money.minor(p.amount)}</span>
        </div>
      ))}
    </div>
  );
}
