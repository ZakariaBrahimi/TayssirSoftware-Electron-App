"use client";

import { CloudCheck, CloudOff, RefreshCw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMe } from "@/hooks/use-me";
import { useSyncMutations, useSyncStatus } from "@/features/settings/api";

/** Cloud sync state of a desktop install (admins of linked installs only). */
export function SyncIndicator() {
  const t = useTranslations("nav");
  const format = useFormatter();
  const { data: me } = useMe();
  const { isAdmin } = useCurrentUser();
  const enabled = me?.mode === "local" && isAdmin;
  const { data: status } = useSyncStatus(enabled);
  const { now } = useSyncMutations();
  if (!enabled || !status?.linked) return null;

  const failed = Boolean(status.lastError);
  const label = now.isPending
    ? t("syncing")
    : failed
      ? t("syncError")
      : status.lastSyncAt
        ? t("synced", { time: format.relativeTime(new Date(status.lastSyncAt)) })
        : t("notSynced");
  const Icon = now.isPending ? RefreshCw : failed ? CloudOff : CloudCheck;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={() => now.mutate()}
          disabled={now.isPending}
          className={failed ? "text-destructive" : "text-muted-foreground"}
        >
          <Icon className={now.isPending ? "animate-spin" : undefined} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{failed ? `${label}: ${status.lastError}` : label}</TooltipContent>
    </Tooltip>
  );
}
