"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import type { ThresholdsInput } from "@/lib/validators";

export type StockAlerts = InferResponseType<typeof api.stock.alerts.$get, 200>;
export type StockAlertItem = StockAlerts["items"][number];

/** Under ["products"] so sales, purchases and product edits refresh it. */
export const stockAlertsKey = ["products", "stock-alerts"] as const;

export function useStockAlerts() {
  return useQuery({
    queryKey: stockAlertsKey,
    queryFn: () => unwrap(api.stock.alerts.$get()),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
}

export function useSetThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: ThresholdsInput) => unwrap(api.stock.thresholds.$post({ json })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

/** Lines handed from the reorder page to a new purchase. */
export const PURCHASE_PREFILL_KEY = "mizan.purchase-prefill";
export type PurchasePrefill = {
  productId: string;
  name: string;
  currentCost: number;
  quantity: number;
  unitCost: number;
  unit?: string;
}[];
