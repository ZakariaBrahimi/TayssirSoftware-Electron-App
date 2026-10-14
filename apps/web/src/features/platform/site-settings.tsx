"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { platformSettingsInput } from "@/lib/validators/platform";
import { type PlatformSettings, usePlatformSettings, useSaveSettings } from "./api";

type Form = Record<keyof PlatformSettings, string>;

const toForm = (s: PlatformSettings): Form => ({
  trialDays: String(s.trialDays),
  downloadUrl: s.downloadUrl,
  contactPhone: s.contactPhone,
  contactWhatsapp: s.contactWhatsapp,
  contactEmail: s.contactEmail,
  payeeName: s.payeeName,
  ccpAccount: s.ccpAccount,
  ripAccount: s.ripAccount,
  bankRib: s.bankRib,
  paymentNote: s.paymentNote,
});

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}

function SettingsForm({ initial }: { initial: PlatformSettings }) {
  const t = useTranslations("platform.site");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const save = useSaveSettings();
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(initial));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = platformSettingsInput.safeParse({
      trialDays: Number(form.trialDays),
      downloadUrl: form.downloadUrl.trim(),
      contactPhone: form.contactPhone,
      contactWhatsapp: form.contactWhatsapp.replace(/[\s+]/g, ""),
      contactEmail: form.contactEmail.trim(),
      payeeName: form.payeeName.trim(),
      ccpAccount: form.ccpAccount.trim(),
      ripAccount: form.ripAccount.trim(),
      bankRib: form.bankRib.trim(),
      paymentNote: form.paymentNote.trim(),
    });
    if (!parsed.success) {
      const next: Partial<Record<keyof Form, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Form;
        next[key] ??= t(`invalid_${key}`);
      }
      setErrors(next);
      return;
    }
    setErrors({});
    save.mutate(parsed.data, {
      onSuccess: (saved) => {
        setForm(toForm(saved));
        toast.success(t("saved"));
      },
      onError: (err) =>
        toast.error(
          err instanceof ApiError && err.code === "VALIDATION_ERROR"
            ? t("checkFields")
            : errorMessage(err),
        ),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pricing")}</CardTitle>
          <CardDescription>{t("pricingHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/platform/plans">{t("openPlans")}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("payment")}</CardTitle>
          <CardDescription>{t("paymentHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="payeeName" label={t("f_payeeName")} error={errors.payeeName}>
            <Input id="payeeName" value={form.payeeName} onChange={set("payeeName")} />
          </Field>
          <Field id="ccpAccount" label={t("f_ccpAccount")} error={errors.ccpAccount}>
            <Input
              id="ccpAccount"
              dir="ltr"
              value={form.ccpAccount}
              onChange={set("ccpAccount")}
              placeholder="0012345678 clé 90"
            />
          </Field>
          <Field id="ripAccount" label={t("f_ripAccount")} error={errors.ripAccount}>
            <Input
              id="ripAccount"
              dir="ltr"
              value={form.ripAccount}
              onChange={set("ripAccount")}
              placeholder="00799999001234567890"
            />
          </Field>
          <Field id="bankRib" label={t("f_bankRib")} error={errors.bankRib}>
            <Input id="bankRib" dir="ltr" value={form.bankRib} onChange={set("bankRib")} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="paymentNote" label={t("f_paymentNote")} error={errors.paymentNote}>
              <Input id="paymentNote" value={form.paymentNote} onChange={set("paymentNote")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("trial")}</CardTitle>
          <CardDescription>{t("trialHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="trialDays" label={t("f_trialDays")} error={errors.trialDays}>
            <Input
              id="trialDays"
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              value={form.trialDays}
              onChange={set("trialDays")}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("download")}</CardTitle>
          <CardDescription>{t("downloadHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Field id="downloadUrl" label={t("f_downloadUrl")} error={errors.downloadUrl}>
            <Input
              id="downloadUrl"
              type="url"
              dir="ltr"
              value={form.downloadUrl}
              onChange={set("downloadUrl")}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("contact")}</CardTitle>
          <CardDescription>{t("contactHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field id="contactPhone" label={t("f_contactPhone")} error={errors.contactPhone}>
            <Input
              id="contactPhone"
              dir="ltr"
              value={form.contactPhone}
              onChange={set("contactPhone")}
              placeholder="+213 555 12 34 56"
            />
          </Field>
          <Field
            id="contactWhatsapp"
            label={t("f_contactWhatsapp")}
            hint={t("whatsappHint")}
            error={errors.contactWhatsapp}
          >
            <Input
              id="contactWhatsapp"
              dir="ltr"
              inputMode="tel"
              value={form.contactWhatsapp}
              onChange={set("contactWhatsapp")}
              placeholder="213555123456"
            />
          </Field>
          <Field id="contactEmail" label={t("f_contactEmail")} error={errors.contactEmail}>
            <Input
              id="contactEmail"
              type="email"
              dir="ltr"
              value={form.contactEmail}
              onChange={set("contactEmail")}
              placeholder="contact@example.com"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {tc("save")}
        </Button>
        <p className="text-muted-foreground text-sm">{t("liveHint")}</p>
      </div>
    </form>
  );
}

export function SiteSettings() {
  const t = useTranslations("platform.site");
  const locale = useLocale();
  const settings = usePlatformSettings();
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button variant="outline" asChild>
            <a href={`/${locale}?preview`} target="_blank" rel="noopener">
              <ExternalLink />
              {t("view")}
            </a>
          </Button>
        }
      />
      {settings.data ? (
        <SettingsForm initial={settings.data} />
      ) : (
        <Skeleton className="h-96 w-full max-w-3xl" />
      )}
    </>
  );
}
