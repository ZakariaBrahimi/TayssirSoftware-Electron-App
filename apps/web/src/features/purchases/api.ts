"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { toQuery } from "@/lib/query-string";
import type { PurchaseCreateInput, PurchaseListQuery } from "@/lib/validators";

export type PurchasePage = InferResponseType<typeof api.purchases.$get, 200>;
export type Purchase = InferResponseType<(typeof api.purchases)[":id"]["$get"], 200>;

export function usePurchases(query: PurchaseListQuery) {
  return useQuery({
    queryKey: ["purchases", "list", query],
    queryFn: () => unwrap(api.purchases.$get({ query: toQuery(query) })),
    placeholderData: keepPreviousData,
  });
}

export function usePurchase(id: string | null) {
  return useQuery({
    queryKey: ["purchases", "detail", id],
    queryFn: () => unwrap(api.purchases[":id"].$get({ param: { id: id! } })),
    enabled: !!id,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: PurchaseCreateInput) => unwrap(api.purchases.$post({ json })),
    onSuccess: () => {
      for (const key of ["purchases", "products", "suppliers", "reports"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
