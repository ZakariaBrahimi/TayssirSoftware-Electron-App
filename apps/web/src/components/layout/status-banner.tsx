"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMe } from "@/hooks/use-me";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Trial countdown / expired license or subscription notice. */
export function StatusBanner() {
  const t = useTranslations("banner");
  const { data: me } = useMe();
  const { isAdmin } = useCurrentUser();
  const ent = me?.entitlement;
  if (!ent || ent.status === "active" || ent.status === "unmanaged") return null;
  const cloud = me.mode === "cloud";
  const suspended = ent.status === "suspended";
  const expired = ent.status === "expired" || suspended;
  // Remind during the last week of a trial, always when expired.
  if (!expired && (ent.daysLeft ?? 99) > 7) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm print:hidden",
        expired ? "bg-destructive/10 text-destructive" : "bg-warning/15",
      )}
    >
      {expired ? (
        <AlertTriangle className="size-4 shrink-0" />
      ) : (
        <Clock className="size-4 shrink-0" />
      )}
      <span className="flex-1">
        {suspended
          ? t("suspended")
          : expired
            ? t(cloud ? "expiredCloud" : "expired")
            : t(cloud ? "trialCloud" : "trial", { days: ent.daysLeft ?? 0 })}
      </span>
      {isAdmin && !cloud && (
        <Button asChild size="sm" variant={expired ? "destructive" : "outline"}>
          <Link href="/settings?tab=license">{t("activate")}</Link>
        </Button>
      )}
      {cloud && !suspended && <span className="text-xs opacity-80">{t("contact")}</span>}
    </div>
  );
}
