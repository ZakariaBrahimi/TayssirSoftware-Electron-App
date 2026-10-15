"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { StoreStatus } from "@/lib/validators/platform";

type Variant = "success" | "warning" | "destructive" | "secondary" | "outline";

const storeVariants: Record<StoreStatus, Variant> = {
  trialing: "secondary",
  trial_expired: "warning",
  active: "success",
  past_due: "warning",
  expired: "destructive",
  canceled: "outline",
  suspended: "destructive",
};

export function StoreStatusBadge({ status }: { status: StoreStatus }) {
  const t = useTranslations("platform.status");
  return <Badge variant={storeVariants[status]}>{t(status)}</Badge>;
}

const simpleVariants: Record<string, Variant> = {
  active: "success",
  expired: "warning",
  stale: "warning",
  revoked: "destructive",
};

export function LicenseStatusBadge({ status }: { status: "active" | "expired" | "revoked" }) {
  const t = useTranslations("platform.licenseStatus");
  return <Badge variant={simpleVariants[status]}>{t(status)}</Badge>;
}

export function DeviceStatusBadge({ status }: { status: "active" | "stale" | "revoked" }) {
  const t = useTranslations("platform.deviceStatus");
  return <Badge variant={simpleVariants[status]}>{t(status)}</Badge>;
}

type DateLike = string | number | Date | null | undefined;

/** "3 days ago" / "in 5 days", with the exact date on hover. */
export function RelativeDate({ value, fallback = "—" }: { value: DateLike; fallback?: string }) {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">{fallback}</span>;
  }
  const date = new Date(value);
  return (
    <time
      dateTime={date.toISOString()}
      title={format.dateTime(date, { dateStyle: "medium", timeStyle: "short" })}
      className="whitespace-nowrap"
    >
      {format.relativeTime(date, now)}
    </time>
  );
}

export function ShortDate({ value, fallback = "—" }: { value: DateLike; fallback?: string }) {
  const format = useFormatter();
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">{fallback}</span>;
  }
  return (
    <span className="whitespace-nowrap">
      {format.dateTime(new Date(value), { dateStyle: "medium" })}
    </span>
  );
}

/** yyyy-mm-dd for date inputs. */
export const toDateInput = (value: DateLike) =>
  value === null || value === undefined ? "" : new Date(value).toISOString().slice(0, 10);

/** Filter select value meaning "no filter". */
export const ALL = "all";
