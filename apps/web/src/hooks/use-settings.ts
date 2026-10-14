"use client";

import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { useFormatter, useLocale } from "next-intl";
import { useCallback } from "react";
import { api, unwrap } from "@/lib/api-client";
import { formatMoney, toMajor, toMinor } from "@/lib/money";

export type StoreSettings = InferResponseType<typeof api.settings.$get, 200>;

export const settingsQuery = {
  queryKey: ["settings"] as const,
  queryFn: () => unwrap(api.settings.$get()),
  staleTime: 5 * 60_000,
};

export function useSettings() {
  return useQuery(settingsQuery);
}

export function useCurrency() {
  return useSettings().data?.currency ?? "DZD";
}

/** Money helpers bound to the store currency and the UI locale. */
export function useMoney() {
  const currency = useCurrency();
  const locale = useLocale();
  const format = useCallback(
    (minor: number) => formatMoney(minor, currency, locale),
    [currency, locale],
  );
  return {
    currency,
    format,
    toMinor: (major: number) => toMinor(major, currency),
    toMajor: (minor: number) => toMajor(minor, currency),
  };
}

export function useDateFormat() {
  const format = useFormatter();
  return {
    dateTime: (d: string | Date | number) =>
      format.dateTime(new Date(d), { dateStyle: "medium", timeStyle: "short" }),
    date: (d: string | Date | number) => format.dateTime(new Date(d), { dateStyle: "medium" }),
  };
}
