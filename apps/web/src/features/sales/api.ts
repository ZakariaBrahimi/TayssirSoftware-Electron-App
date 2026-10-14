"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import type { SaleCreateInput, SaleListQuery } from "@/lib/validators";

export type Sale = InferResponseType<(typeof api.sales)[":id"]["$get"], 200>;
export type SalePage = InferResponseType<typeof api.sales.$get, 200>;

export const saleKeys = {
  all: ["sales"] as const,
  list: (q: SaleListQuery) => ["sales", "list", q] as const,
  detail: (id: number) => ["sales", "detail", id] as const,
};

export function useSales(query: SaleListQuery) {
  const q: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") q[k] = String(v);
  return useQuery({
    queryKey: saleKeys.list(query),
    queryFn: () => unwrap(api.sales.$get({ query: q as never })),
    placeholderData: keepPreviousData,
  });
}

export function useSale(id: number | null) {
  return useQuery({
    queryKey: saleKeys.detail(id ?? 0),
    queryFn: () => unwrap(api.sales[":id"].$get({ param: { id: String(id) } })),
    enabled: !!id,
  });
}

function useInvalidateAfterSale() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: saleKeys.all });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["reports"] });
  };
}

export function useCreateSale() {
  const invalidate = useInvalidateAfterSale();
  return useMutation({
    mutationFn: (json: SaleCreateInput) => unwrap(api.sales.$post({ json })),
    onSuccess: invalidate,
  });
}

export function useVoidSale() {
  const invalidate = useInvalidateAfterSale();
  return useMutation({
    mutationFn: (id: number) => unwrap(api.sales[":id"].void.$post({ param: { id: String(id) } })),
    onSuccess: invalidate,
  });
}
