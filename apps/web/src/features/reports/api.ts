"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { dayEndIso, dayStartIso, tzOffsetMinutes } from "@/lib/dates";

export type SalesReport = InferResponseType<typeof api.reports.sales.$get, 200>;

export function useSalesReport(
  range: { from: string; to: string },
  enabled = true,
  groupVariants = true,
) {
  return useQuery({
    queryKey: ["reports", "sales", range, groupVariants],
    queryFn: () =>
      unwrap(
        api.reports.sales.$get({
          query: {
            from: dayStartIso(range.from),
            to: dayEndIso(range.to),
            tzOffset: String(tzOffsetMinutes()),
            groupVariants: groupVariants ? "true" : "false",
          },
        }),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useInventoryOverview(enabled = true) {
  return useQuery({
    queryKey: ["reports", "inventory"],
    queryFn: () => unwrap(api.reports.inventory.$get()),
    enabled,
  });
}
