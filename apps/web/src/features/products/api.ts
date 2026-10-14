"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import type {
  FamilyInput,
  ProductCreateInput,
  ProductListQuery,
  ProductUpdateInput,
  StockAdjustmentInput,
} from "@/lib/validators";

export type Product = InferResponseType<(typeof api.products)[":id"]["$get"], 200>;
export type ProductPage = InferResponseType<typeof api.products.$get, 200>;

function toQuery(q: ProductListQuery) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out;
}

export const productKeys = {
  all: ["products"] as const,
  list: (q: ProductListQuery) => ["products", "list", q] as const,
  detail: (id: string) => ["products", "detail", id] as const,
  movements: (id: string) => ["products", "movements", id] as const,
};

export function useProducts(query: ProductListQuery, enabled = true) {
  return useQuery({
    queryKey: productKeys.list(query),
    queryFn: () => unwrap(api.products.$get({ query: toQuery(query) as never })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => unwrap(api.products[":id"].$get({ param: { id } })),
    enabled: !!id,
  });
}

export function useStockMovements(id: string) {
  return useQuery({
    queryKey: productKeys.movements(id),
    queryFn: () => unwrap(api.products[":id"].movements.$get({ param: { id } })),
  });
}

export async function fetchProductByBarcode(barcode: string) {
  return unwrap(api.products["by-barcode"][":barcode"].$get({ param: { barcode } }));
}

export async function generateBarcode() {
  return (await unwrap(api.products["generate-barcode"].$post())).barcode;
}

export async function isBarcodeAvailable(barcode: string, exceptId?: string) {
  const res = await unwrap(
    api.products["barcode-available"].$get({
      query: { barcode, ...(exceptId ? { exceptId } : {}) },
    }),
  );
  return res.available;
}

export function useProductMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: productKeys.all });

  return {
    create: useMutation({
      mutationFn: (json: ProductCreateInput) => unwrap(api.products.$post({ json })),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, json }: { id: string; json: ProductUpdateInput }) =>
        unwrap(api.products[":id"].$patch({ param: { id }, json })),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => unwrap(api.products[":id"].$delete({ param: { id } })),
      onSuccess: invalidate,
    }),
    adjustStock: useMutation({
      mutationFn: ({ id, json }: { id: string; json: StockAdjustmentInput }) =>
        unwrap(api.products[":id"].stock.$post({ param: { id }, json })),
      onSuccess: invalidate,
    }),
  };
}

/* ------------------------- Families (variants) ------------------------- */

export type Family = InferResponseType<(typeof api.families)[":id"]["$get"], 200>;

export function useFamily(id: string | null | undefined) {
  return useQuery({
    queryKey: ["products", "family", id],
    queryFn: () => unwrap(api.families[":id"].$get({ param: { id: id! } })),
    enabled: !!id,
  });
}

export function useFamilyMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: productKeys.all });
  return {
    create: useMutation({
      mutationFn: (json: FamilyInput) => unwrap(api.families.$post({ json })),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, json }: { id: string; json: FamilyInput }) =>
        unwrap(api.families[":id"].$put({ param: { id }, json })),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => unwrap(api.families[":id"].$delete({ param: { id } })),
      onSuccess: invalidate,
    }),
  };
}
