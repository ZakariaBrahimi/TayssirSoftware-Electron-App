"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Cloud, Laptop, Loader2, RefreshCw, Unlink } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMe } from "@/hooks/use-me";
import { useRevokeDevice, useSyncDevices, useSyncMutations, useSyncStatus } from "./api";

const linkSchema = z.object({
  cloudUrl: z.string().trim().url("invalid_url"),
  username: z.string().trim().min(1, "required"),
  password: z.string().min(1, "required"),
  deviceName: z.string().trim().min(1, "required").max(60),
});
type LinkValues = z.infer<typeof linkSchema>;

function LinkForm() {
  const t = useTranslations("settings");
  const errorMessage = useErrorMessage();
  const { link } = useSyncMutations();
  const form = useForm<LinkValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: { cloudUrl: "https://", username: "", password: "", deviceName: "Caisse 1" },
  });
  const field = (
    name: keyof LinkValues,
    label: string,
    props: React.ComponentProps<"input"> = {},
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...props} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
  return (
    <Form {...form}>
      <form
        className="grid max-w-xl gap-4"
        onSubmit={form.handleSubmit((v) =>
          link.mutate(v, {
            onSuccess: () => toast.success(t("syncDone")),
            onError: (err) => toast.error(errorMessage(err)),
          }),
        )}
      >
        {field("cloudUrl", t("cloudUrl"), { dir: "ltr", type: "url" })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("username", t("cloudUsername"), { dir: "ltr", autoComplete: "off" })}
          {field("password", t("cloudPassword"), { type: "password", autoComplete: "off" })}
        </div>
        {field("deviceName", t("deviceName"))}
        <p className="text-muted-foreground text-sm">{t("linkWarning")}</p>
        <Button type="submit" disabled={link.isPending} className="justify-self-start">
          {link.isPending ? <Loader2 className="animate-spin" /> : <Cloud />}
          {t("link")}
        </Button>
      </form>
    </Form>
  );
}

/** Local install: connection to a cloud store. */
function SyncClientPanel() {
  const t = useTranslations("settings");
  const format = useFormatter();
  const currentTime = useNow({ updateInterval: 30_000 });
  const errorMessage = useErrorMessage();
  const status = useSyncStatus(true);
  const { now, unlink } = useSyncMutations();
  const onError = (err: unknown) => toast.error(errorMessage(err));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sync")}</CardTitle>
        <CardDescription>{t("syncDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {status.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : !status.data?.linked ? (
          <LinkForm />
        ) : (
          <div className="grid max-w-xl gap-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Cloud className="text-success size-4" />
              {t("linked", { url: status.data.cloudUrl ?? "" })}
            </p>
            <p className="text-muted-foreground">
              {status.data.deviceName} ·{" "}
              {t("lastSync", {
                time: status.data.lastSyncAt
                  ? format.relativeTime(new Date(status.data.lastSyncAt), currentTime)
                  : "—",
              })}{" "}
              · {t("pending", { count: status.data.pending })}
            </p>
            {status.data.lastError && (
              <p className="bg-destructive/10 text-destructive rounded-md p-3">
                {status.data.lastError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  now.mutate(undefined, { onSuccess: () => toast.success(t("syncDone")), onError })
                }
                disabled={now.isPending}
              >
                <RefreshCw className={now.isPending ? "animate-spin" : undefined} />
                {t("syncNow")}
              </Button>
              <ConfirmDialog
                description={t("unlinkConfirm")}
                confirmLabel={t("unlink")}
                onConfirm={() => unlink.mutate(undefined, { onError })}
                trigger={
                  <Button variant="ghost" className="text-destructive">
                    <Unlink />
                    {t("unlink")}
                  </Button>
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Cloud store: desktop installs syncing with it. */
function SyncDevicesPanel() {
  const t = useTranslations("settings");
  const format = useFormatter();
  const currentTime = useNow({ updateInterval: 30_000 });
  const errorMessage = useErrorMessage();
  const devices = useSyncDevices(true);
  const revoke = useRevokeDevice();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("devices")}</CardTitle>
        <CardDescription>{t("devicesDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {devices.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : !devices.data?.length ? (
          <p className="text-muted-foreground text-sm">{t("noDevices")}</p>
        ) : (
          <ul className="max-w-3xl divide-y rounded-lg border text-sm">
            {devices.data.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Laptop className="text-muted-foreground size-4" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {d.name}{" "}
                    <span className="text-muted-foreground font-mono text-xs">
                      ({d.deviceCode})
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {d.lastSeenAt
                      ? t("lastSeen", {
                          time: format.relativeTime(new Date(d.lastSeenAt), currentTime),
                        })
                      : "—"}
                  </span>
                </div>
                {d.revokedAt ? (
                  <Badge variant="secondary">{t("revoked")}</Badge>
                ) : (
                  <ConfirmDialog
                    description={t("revokeConfirm", { name: d.name })}
                    confirmLabel={t("revoke")}
                    onConfirm={() =>
                      revoke.mutate(d.id, { onError: (err) => toast.error(errorMessage(err)) })
                    }
                    trigger={
                      <Button variant="ghost" size="sm" className="text-destructive">
                        {t("revoke")}
                      </Button>
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function SyncPanel() {
  const { data: me } = useMe();
  if (!me) return <Skeleton className="h-40 w-full" />;
  return me.mode === "cloud" ? <SyncDevicesPanel /> : <SyncClientPanel />;
}
