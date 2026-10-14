"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMe } from "@/hooks/use-me";
import { useDateFormat } from "@/hooks/use-settings";
import { Link } from "@/i18n/navigation";
import { useLicenseMutations } from "./api";

/** License (local installs) or subscription (cloud stores) status. */
export function LicensePanel() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const dates = useDateFormat();
  const errorMessage = useErrorMessage();
  const { data: me } = useMe();
  const { activate, remove } = useLicenseMutations();
  const [key, setKey] = useState("");

  if (!me) return <Skeleton className="h-60 w-full" />;
  const ent = me.entitlement;
  const cloud = me.mode === "cloud";

  const statusVariant =
    ent.status === "expired" || ent.status === "suspended"
      ? "destructive"
      : ent.status === "active"
        ? "success"
        : "secondary";
  const rows: [string, React.ReactNode][] = [
    [
      t("licenseStatus"),
      <Badge key="s" variant={statusVariant}>
        {t(`status_${ent.status}`)}
      </Badge>,
    ],
    [t("licenseSource"), t(`source_${ent.source}`)],
    [t("licensePlan"), ent.plan ?? "—"],
    [
      t("licenseExpires"),
      ent.status === "unmanaged"
        ? "—"
        : ent.expiresAt
          ? `${dates.date(ent.expiresAt)}${ent.daysLeft !== null && ent.status !== "expired" ? ` (${t("daysLeft", { days: ent.daysLeft })})` : ""}`
          : tc("never"),
    ],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{cloud ? t("subscription") : t("license")}</CardTitle>
        <CardDescription>
          {cloud
            ? t("subscriptionHelp")
            : ent.status === "unmanaged"
              ? t("licenseUnmanaged")
              : t("licenseHelp")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid max-w-xl gap-6">
        {ent.status !== "unmanaged" && (
          <Button asChild variant="outline" className="justify-self-start">
            <Link href="/subscription">{t("managePlan")}</Link>
          </Button>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {!cloud && ent.status !== "unmanaged" && (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              activate.mutate(key, {
                onSuccess: () => {
                  toast.success(t("activated"));
                  setKey("");
                },
                onError: (err) => toast.error(errorMessage(err)),
              });
            }}
          >
            <Label htmlFor="license-key">{t("licenseKey")}</Label>
            <div className="flex gap-2">
              <Input
                id="license-key"
                dir="ltr"
                className="font-mono uppercase"
                placeholder={t("licenseKeyPlaceholder")}
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <Button type="submit" disabled={key.trim().length < 20 || activate.isPending}>
                {activate.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
                {t("activate")}
              </Button>
            </div>
          </form>
        )}

        {!cloud && ent.source === "license" && (
          <ConfirmDialog
            onConfirm={() =>
              remove.mutate(undefined, { onError: (err) => toast.error(errorMessage(err)) })
            }
            trigger={
              <Button variant="ghost" className="text-destructive justify-self-start">
                {t("removeLicense")}
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
