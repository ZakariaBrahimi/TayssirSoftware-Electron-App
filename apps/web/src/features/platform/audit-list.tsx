"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/validators/platform";
import { type AuditPage, useAudit, usePlatformMoney } from "./api";
import { ALL, RelativeDate } from "./shared";

type Entry = AuditPage["rows"][number];

/** "store.suspend" -> "a_store_suspend" (dots would mean nesting in messages). */
const actionKey = (action: string) =>
  `a_${action.replace(/\./g, "_")}` as `a_${string}` as "a_store_suspend";

function useDescribe() {
  const t = useTranslations("platform.audit");
  const ts = useTranslations("platform.status");
  const tm = useTranslations("platform.methods");
  const tsite = useTranslations("platform.site");
  const money = usePlatformMoney();
  const date = (v: unknown) =>
    typeof v === "number" ? new Date(v).toISOString().slice(0, 10) : t("noEndDate");

  return (e: Entry): string => {
    const d = (e.details ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
    switch (e.action) {
      case "store.subscription": {
        const from = d.from as { status: string } | undefined;
        const to = d.to as { status: string; plan: string; until: number | null } | undefined;
        if (!from || !to) return "";
        return t("d_subscription", {
          from: ts(from.status as "active"),
          to: ts(to.status as "active"),
          plan: to.plan,
          until: date(to.until),
        });
      }
      case "store.trial_extend":
        return t("d_trial", { days: Number(d.days), until: date(d.until) });
      case "store.suspend":
        return str(d.reason);
      case "store.user_password_reset":
        return `@${str(d.username)}`;
      case "license.create":
        return t("d_license", {
          hint: str(d.hint),
          plan: str(d.plan),
          devices: Number(d.maxDevices),
          customer: str(d.customer) || "—",
        });
      case "license.update":
      case "license.revoke":
      case "license.restore":
        return `…${str(d.hint)}${d.customer ? ` · ${str(d.customer)}` : ""}`;
      case "license.reset":
      case "license.device_remove":
        return `…${str(d.hint)} · ${((d.devices as string[]) ?? []).join(", ")}`;
      case "device.revoke":
        return `${str(d.name)} (${str(d.code)})`;
      case "payment.create":
        return t("d_payment", {
          amount: money.format(Number(d.amount)),
          method: tm(str(d.method) as "cash"),
          months: Number(d.months),
        });
      case "platform.settings": {
        const changes = Object.keys((d.changes as Record<string, unknown>) ?? {});
        return changes.map((k) => tsite(`f_${k}` as "f_trialDays")).join(", ");
      }
      case "payment.void":
        return `${money.format(Number(d.amount))}${d.reason ? ` · ${str(d.reason)}` : ""}`;
      case "plan.create":
        return str(d.code);
      case "plan.update":
        return `${str(d.code)}${Array.isArray(d.changed) && d.changed.length ? ` · ${(d.changed as string[]).join(", ")}` : ""}`;
      case "request.approve":
        return `${str(d.plan)} · ${money.format(Number(d.amount))}${d.newLicense ? ` · ${t("d_newLicense")}` : ""}`;
      case "request.reject":
        return `${str(d.plan)}${d.reason ? ` · ${str(d.reason)}` : ""}`;
      default:
        return "";
    }
  };
}

function targetHref(e: Entry) {
  if (e.storeId) return `/platform/stores/${e.storeId}`;
  if (e.targetType === "license" && e.targetId) return `/platform/licenses?id=${e.targetId}`;
  return null;
}

/** Audit entries as a compact list (also used on the store page). */
export function AuditTable({
  data,
  isLoading,
  compact,
}: {
  data: AuditPage | undefined;
  isLoading: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("platform.audit");
  const describe = useDescribe();
  if (isLoading && !data) return <Skeleton className="h-32 w-full" />;
  if (!data?.rows.length) return <p className="text-muted-foreground py-3 text-sm">{t("empty")}</p>;
  return (
    <ol className={cn("divide-y", !compact && "bg-card rounded-lg border")}>
      {data.rows.map((e) => {
        const href = compact ? null : targetHref(e);
        const text = describe(e);
        return (
          <li
            key={e.id}
            className={cn("flex flex-wrap gap-x-3 gap-y-1 py-2.5 text-sm", !compact && "px-4")}
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium">
                {t.has(actionKey(e.action)) ? t(actionKey(e.action)) : e.action}
              </span>
              {text && <span className="text-muted-foreground"> · {text}</span>}
              {href && (
                <Link href={href} className="text-primary ms-2 text-xs hover:underline">
                  {t("open")}
                </Link>
              )}
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span dir="ltr">{e.actorName}</span>
              {e.ip && !compact && <span dir="ltr">· {e.ip}</span>}
              <span>·</span>
              <RelativeDate value={e.createdAt} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function AuditList() {
  const t = useTranslations("platform.audit");
  const [action, setAction] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const query = useAudit({
    action: action === ALL ? undefined : (action as AuditAction),
    page,
    pageSize: 50,
  });
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-60" aria-label={t("action")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allActions")}</SelectItem>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {t(actionKey(a))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <AuditTable data={query.data} isLoading={query.isPending} />
      {query.data && (
        <Pagination
          page={query.data.page}
          pageCount={query.data.pageCount}
          total={query.data.total}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
