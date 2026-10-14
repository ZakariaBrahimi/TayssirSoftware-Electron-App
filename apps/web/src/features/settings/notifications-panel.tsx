"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, RefreshCw, Send, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMe } from "@/hooks/use-me";
import { Link } from "@/i18n/navigation";
import { api, unwrap } from "@/lib/api-client";
import { useSyncStatus } from "./api";

const LOCALES = [
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
] as const;
type DigestLocale = (typeof LOCALES)[number]["value"];

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
      <path d="M21.9 4.3 18.6 19.8c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L5.9 13.3l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6L20.4 2.8c.9-.3 1.7.2 1.5 1.5Z" />
    </svg>
  );
}

function useAlerts() {
  return useQuery({ queryKey: ["alerts"], queryFn: () => unwrap(api.alerts.$get()) });
}

function CloudNotifications() {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const uiLocale = useLocale();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const { data, refetch, isFetching } = useAlerts();
  const [email, setEmail] = useState("");
  const [waiting, setWaiting] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["alerts"] });
  const onError = (err: Error) => toast.error(errorMessage(err));

  const saveSettings = useMutation({
    mutationFn: (json: { enabled: boolean; digestHour: number; locale: DigestLocale }) =>
      unwrap(api.alerts.settings.$put({ json })),
    onSuccess: () => {
      refresh();
      toast.success(tc("saved"));
    },
    onError,
  });
  const linkTelegram = useMutation({
    mutationFn: () => unwrap(api.alerts.telegram.$post()),
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener");
      setWaiting(true);
    },
    onError,
  });
  const addEmail = useMutation({
    mutationFn: (address: string) => unwrap(api.alerts.email.$post({ json: { address } })),
    onSuccess: () => {
      setEmail("");
      refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.alerts.channels[":id"].$delete({ param: { id } })),
    onSuccess: refresh,
    onError,
  });
  const test = useMutation({
    mutationFn: () => unwrap(api.alerts.test.$post()),
    onSuccess: (res) =>
      res.channels === 0
        ? toast.error(t("noChannels"))
        : toast.success(t("testSent", { count: res.sent })),
    onError,
  });

  if (!data) return <Skeleton className="h-80 w-full" />;
  const s = data.settings;
  const save = (patch: Partial<typeof s>) =>
    saveSettings.mutate({
      enabled: patch.enabled ?? s.enabled,
      digestHour: patch.digestHour ?? s.digestHour,
      locale: patch.locale ?? s.locale,
    });
  const telegramChats = data.channels.filter((c) => c.kind === "telegram");
  const emails = data.channels.filter((c) => c.kind === "email");

  return (
    <div className="grid max-w-2xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <span>
              <span className="text-sm font-medium">{t("enabled")}</span>
              <span className="text-muted-foreground block text-xs">{t("enabledHint")}</span>
            </span>
            <Switch checked={s.enabled} onCheckedChange={(enabled) => save({ enabled })} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t("hour")}</Label>
              <Select
                value={String(s.digestHour)}
                onValueChange={(v) => save({ digestHour: Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, h) => (
                    <SelectItem key={h} value={String(h)}>
                      <span dir="ltr">{String(h).padStart(2, "0")}:00</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {t("hourHint", { zone: data.timeZone })}
              </p>
            </div>
            <div className="grid gap-2">
              <Label>{t("language")}</Label>
              <Select value={s.locale} onValueChange={(v) => save({ locale: v as DigestLocale })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l.value} value={l.value} lang={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {s.locale !== uiLocale && LOCALES.some((l) => l.value === uiLocale) && (
                <button
                  type="button"
                  className="text-primary justify-self-start text-xs hover:underline"
                  onClick={() => save({ locale: uiLocale as DigestLocale })}
                >
                  {t("useMyLanguage")}
                </button>
              )}
            </div>
          </div>
          <div>
            <Button
              variant="outline"
              onClick={() => test.mutate()}
              disabled={test.isPending || data.channels.length === 0}
            >
              {test.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              {t("sendNow")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TelegramIcon />
            Telegram
          </CardTitle>
          <CardDescription>{t("telegramHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!data.telegram ? (
            <p className="text-muted-foreground text-sm">{t("notConfigured")}</p>
          ) : (
            <>
              {telegramChats.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <TelegramIcon />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("remove")}
                    onClick={() => remove.mutate(c.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => linkTelegram.mutate()} disabled={linkTelegram.isPending}>
                  {linkTelegram.isPending ? <Loader2 className="animate-spin" /> : <TelegramIcon />}
                  {telegramChats.length ? t("addTelegram") : t("connectTelegram")}
                </Button>
                {waiting && (
                  <Button variant="ghost" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw className={isFetching ? "animate-spin" : undefined} />
                    {t("pressedStart")}
                  </Button>
                )}
              </div>
              {waiting && <p className="text-muted-foreground text-xs">{t("telegramSteps")}</p>}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4" />
            {t("email")}
          </CardTitle>
          <CardDescription>{t("emailHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!data.email ? (
            <p className="text-muted-foreground text-sm">{t("notConfigured")}</p>
          ) : (
            <>
              {emails.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <Mail className="size-4" />
                  <span className="min-w-0 flex-1 truncate" dir="ltr">
                    {c.address}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("remove")}
                    onClick={() => remove.mutate(c.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) addEmail.mutate(email.trim());
                }}
              >
                <Input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@example.com"
                  aria-label={t("email")}
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={addEmail.isPending || !email.trim()}
                >
                  {t("addEmail")}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Desktop installs: summaries come from the online shop they are linked to. */
function LocalNotifications() {
  const t = useTranslations("notifications");
  const sync = useSyncStatus(true);
  const url = sync.data?.linked ? sync.data.cloudUrl : null;
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {url ? (
          <>
            <p>{t("localLinked")}</p>
            <Button asChild variant="outline" className="justify-self-start">
              <a href={`${url}/settings?tab=notifications`} target="_blank" rel="noopener">
                {t("openOnline")}
              </a>
            </Button>
          </>
        ) : (
          <>
            <p>{t("localNotLinked")}</p>
            <Button asChild variant="outline" className="justify-self-start">
              <Link href="/settings?tab=sync">{t("linkPc")}</Link>
            </Button>
          </>
        )}
        <p className="text-muted-foreground text-xs">{t("bellHint")}</p>
      </CardContent>
    </Card>
  );
}

export function NotificationsPanel() {
  const { data: me } = useMe();
  if (!me) return <Skeleton className="h-60 w-full" />;
  return me.mode === "cloud" ? <CloudNotifications /> : <LocalNotifications />;
}
