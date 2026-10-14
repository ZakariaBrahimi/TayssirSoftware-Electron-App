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
import { ApiError } from "@/lib/api-client";
import { platformSettingsInput } from "@/lib/validators/platform";
import { type PlatformSettings, usePlatformSettings, useSaveSettings } from "./api";

type Form = Record<keyof PlatformSettings, string>;

const toForm = (s: PlatformSettings): Form => ({
  cloudMonthly: s.cloudMonthly === null ? "" : String(s.cloudMonthly),
  licenseOneTime: s.licenseOneTime === null ? "" : String(s.licenseOneTime),
  trialDays: String(s.trialDays),
  downloadUrl: s.downloadUrl,
  contactPhone: s.contactPhone,
  contactWhatsapp: s.contactWhatsapp,
  contactEmail: s.contactEmail,
});

const optionalNumber = (v: string) => (v.trim() === "" ? null : Number(v));

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
      cloudMonthly: optionalNumber(form.cloudMonthly),
      licenseOneTime: optionalNumber(form.licenseOneTime),
      trialDays: Number(form.trialDays),
      downloadUrl: form.downloadUrl.trim(),
      contactPhone: form.contactPhone,
      contactWhatsapp: form.contactWhatsapp.replace(/[\s+]/g, ""),
      contactEmail: form.contactEmail.trim(),
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
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            id="cloudMonthly"
            label={t("f_cloudMonthly")}
            hint={t("emptyOnRequest")}
            error={errors.cloudMonthly}
          >
            <Input
              id="cloudMonthly"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={form.cloudMonthly}
              onChange={set("cloudMonthly")}
              placeholder={t("onRequest")}
            />
          </Field>
          <Field
            id="licenseOneTime"
            label={t("f_licenseOneTime")}
            hint={t("emptyOnRequest")}
            error={errors.licenseOneTime}
          >
            <Input
              id="licenseOneTime"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={form.licenseOneTime}
              onChange={set("licenseOneTime")}
              placeholder={t("onRequest")}
            />
          </Field>
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
