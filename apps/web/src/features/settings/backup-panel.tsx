"use client";

import { DatabaseBackup, Download, Loader2, RotateCcw, Upload } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useDateFormat } from "@/hooks/use-settings";
import { useBackupMutations, useBackups } from "./api";

const KINDS = ["auto", "manual", "pre-migration", "pre-restore"] as const;
const kindOf = (name: string) => KINDS.find((k) => name.endsWith(`-${k}.db`)) ?? "manual";

/** Waits for the restarted server, then reloads the app. */
async function reloadWhenBack() {
  await new Promise((r) => setTimeout(r, 1500));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch("/api/health", { cache: "no-store" })).ok) break;
    } catch {
      /* restarting */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  window.location.reload();
}

export function BackupPanel() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const format = useFormatter();
  const dates = useDateFormat();
  const errorMessage = useErrorMessage();
  const backups = useBackups();
  const { create, restoreNamed, restoreFile } = useBackupMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const onRestored = () => {
    setRestoring(true);
    toast.info(t("restoring"));
    void reloadWhenBack();
  };
  const onError = (err: unknown) => toast.error(errorMessage(err));

  if (backups.isPending) return <Skeleton className="h-60 w-full" />;
  if (!backups.data?.available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("backup")}</CardTitle>
          <CardDescription>{t("backupUnavailable")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("backup")}</CardTitle>
        <CardDescription>{t("backupDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid max-w-3xl gap-4">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              create.mutate(undefined, {
                onSuccess: () => toast.success(t("backupCreated")),
                onError,
              })
            }
            disabled={create.isPending || restoring}
          >
            {create.isPending ? <Loader2 className="animate-spin" /> : <DatabaseBackup />}
            {t("backupNow")}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={restoring}>
            <Upload />
            {t("restoreFromFile")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPendingFile(file);
              e.target.value = "";
            }}
          />
        </div>

        <h3 className="mt-2 font-medium">{t("backups")}</h3>
        {backups.data.backups.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noBackups")}</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {backups.data.backups.map((b) => (
              <li key={b.name} className="flex flex-wrap items-center gap-3 px-4 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span>{dates.dateTime(b.createdAt)}</span>
                  <span className="text-muted-foreground text-xs">
                    {format.number(b.size / 1024 / 1024, { maximumFractionDigits: 1 })} MB
                  </span>
                </div>
                <Badge variant="secondary">{t(`kind_${kindOf(b.name)}`)}</Badge>
                <Button variant="ghost" size="icon-sm" asChild aria-label={tc("download")}>
                  <a href={`/api/backup/${encodeURIComponent(b.name)}`} download>
                    <Download />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingName(b.name)}
                  disabled={restoring}
                >
                  <RotateCcw />
                  {t("restore")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={pendingName !== null || pendingFile !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPendingName(null);
            setPendingFile(null);
          }
        }}
        description={t("restoreConfirm")}
        confirmLabel={t("restore")}
        onConfirm={() => {
          if (pendingFile) restoreFile.mutate(pendingFile, { onSuccess: onRestored, onError });
          else if (pendingName)
            restoreNamed.mutate(pendingName, { onSuccess: onRestored, onError });
        }}
      />
    </Card>
  );
}
