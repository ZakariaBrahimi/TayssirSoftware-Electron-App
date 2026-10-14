"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toSVG } from "bwip-js/browser";
import { Check, Copy, Download, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { usePlatformMe } from "./api";

function QrCode({ value }: { value: string }) {
  const svg = useMemo(() => {
    try {
      return toSVG({ bcid: "qrcode", text: value, scale: 4, paddingwidth: 2, paddingheight: 2 });
    } catch {
      return null;
    }
  }, [value]);
  if (!svg) return null;
  return (
    <div
      className="size-48 rounded-md bg-white p-2 [&>svg]:size-full"
      // Generated locally by bwip-js from the authenticator URI.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const t = useTranslations("platform.security");
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="grid gap-3">
      <p className="text-sm">{t("backupCodesHint")}</p>
      <div
        className="bg-muted grid grid-cols-2 gap-x-6 gap-y-1 rounded-md p-4 font-mono text-sm"
        dir="ltr"
      >
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(text).catch(() => {});
            setCopied(true);
          }}
        >
          {copied ? <Check /> : <Copy />}
          {t("copy")}
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <a
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
            download="mizan-platform-backup-codes.txt"
          >
            <Download />
            {t("download")}
          </a>
        </Button>
      </div>
    </div>
  );
}

function errorText(
  error: { message?: string; code?: string } | null | undefined,
  fallback: string,
) {
  return error?.code === "INVALID_PASSWORD" || error?.code === "INVALID_CODE"
    ? fallback
    : (error?.message ?? fallback);
}

/** Enrolment: confirm password, scan the QR code, enter a code. */
function EnableTwoFactor() {
  const t = useTranslations("platform.security");
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ uri: string; codes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  const secret = setup ? new URL(setup.uri).searchParams.get("secret") : null;

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setPending(false);
    if (error || !data || !("totpURI" in data) || !data.totpURI) {
      toast.error(errorText(error, t("wrongPassword")));
      return;
    }
    setSetup({ uri: data.totpURI, codes: data.backupCodes ?? [] });
    setPassword("");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    setPending(false);
    if (error) {
      toast.error(t("wrongCode"));
      return;
    }
    toast.success(t("enabled"));
    await queryClient.invalidateQueries({ queryKey: ["platform"] });
  };

  if (!setup) {
    return (
      <form onSubmit={start} className="grid max-w-sm gap-3">
        <Label htmlFor="tf-password">{t("confirmPassword")}</Label>
        <Input
          id="tf-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <Button type="submit" disabled={!password || pending} className="justify-self-start">
          {pending && <Loader2 className="animate-spin" />}
          {t("start")}
        </Button>
      </form>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-3">
        <p className="text-sm font-medium">1. {t("scan")}</p>
        <QrCode value={setup.uri} />
        {secret && (
          <p className="text-muted-foreground text-xs">
            {t("manualEntry")}{" "}
            <code dir="ltr" className="text-foreground font-mono break-all">
              {secret}
            </code>
          </p>
        )}
      </div>
      <div className="grid content-start gap-6">
        <div className="grid gap-2">
          <p className="text-sm font-medium">2. {t("saveCodes")}</p>
          <BackupCodes codes={setup.codes} />
        </div>
        <form onSubmit={verify} className="grid max-w-xs gap-2">
          <Label htmlFor="tf-code" className="font-medium">
            3. {t("enterCode")}
          </Label>
          <Input
            id="tf-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center font-mono text-lg tracking-[0.4em]"
            dir="ltr"
          />
          <Button type="submit" disabled={code.length !== 6 || pending}>
            {pending && <Loader2 className="animate-spin" />}
            {t("verify")}
          </Button>
        </form>
      </div>
    </div>
  );
}

function RegenerateBackupCodes() {
  const t = useTranslations("platform.security");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  if (codes) return <BackupCodes codes={codes} />;
  return (
    <form
      className="flex max-w-md flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
        setPending(false);
        if (error || !data) {
          toast.error(errorText(error, t("wrongPassword")));
          return;
        }
        setCodes(data.backupCodes);
      }}
    >
      <div className="grid flex-1 gap-2">
        <Label htmlFor="bc-password">{t("confirmPassword")}</Label>
        <Input
          id="bc-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" variant="outline" disabled={!password || pending}>
        {t("regenerate")}
      </Button>
    </form>
  );
}

function ChangePassword() {
  const t = useTranslations("platform.security");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid max-w-sm gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const { error } = await authClient.changePassword({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        });
        setPending(false);
        if (error) {
          toast.error(errorText(error, t("wrongPassword")));
          return;
        }
        setCurrent("");
        setNext("");
        toast.success(t("passwordChanged"));
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="pw-current">{t("currentPassword")}</Label>
        <Input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="pw-new">{t("newPassword")}</Label>
        <Input
          id="pw-new"
          type="password"
          autoComplete="new-password"
          minLength={10}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">{t("passwordRule")}</p>
      </div>
      <Button
        type="submit"
        disabled={!current || next.length < 10 || pending}
        className="justify-self-start"
      >
        {t("changePassword")}
      </Button>
    </form>
  );
}

export function SecurityScreen() {
  const t = useTranslations("platform.security");
  const me = usePlatformMe();
  const enabled = me.data?.user.twoFactorEnabled;

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid max-w-4xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {enabled ? (
                <ShieldCheck className="text-success size-5" />
              ) : (
                <ShieldAlert className="text-destructive size-5" />
              )}
              {t("twoFactor")}
              <Badge variant={enabled ? "success" : "destructive"} className="ms-1">
                {enabled ? t("on") : t("off")}
              </Badge>
            </CardTitle>
            <CardDescription>{enabled ? t("onHint") : t("required")}</CardDescription>
          </CardHeader>
          <CardContent>{enabled ? <RegenerateBackupCodes /> : <EnableTwoFactor />}</CardContent>
        </Card>
        {enabled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("password")}</CardTitle>
              <CardDescription>{t("passwordHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePassword />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
