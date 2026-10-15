"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { toQuery } from "@/lib/query-string";
import type { PartyListQuery, PaymentInput, SupplierInput } from "@/lib/validators";

export type SupplierPage = InferResponseType<typeof api.suppliers.$get, 200>;
export type SupplierStatement = InferResponseType<
  (typeof api.suppliers)[":id"]["statement"]["$get"],
  200
>;

export function useSuppliers(query: PartyListQuery) {
  return useQuery({
    queryKey: ["suppliers", "list", query],
    queryFn: () => unwrap(api.suppliers.$get({ query: toQuery(query) })),
    placeholderData: keepPreviousData,
  });
}

export function useSupplierStatement(id: string) {
  return useQuery({
    queryKey: ["suppliers", "statement", id],
    queryFn: () => unwrap(api.suppliers[":id"].statement.$get({ param: { id } })),
  });
}

export function useSupplierMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["suppliers"] });
  return {
    create: useMutation({
      mutationFn: (json: SupplierInput) => unwrap(api.suppliers.$post({ json })),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, json }: { id: string; json: SupplierInput }) =>
        unwrap(api.suppliers[":id"].$patch({ param: { id }, json })),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => unwrap(api.suppliers[":id"].$delete({ param: { id } })),
      onSuccess: invalidate,
    }),
    pay: useMutation({
      mutationFn: ({ id, json }: { id: string; json: PaymentInput }) =>
        unwrap(api.suppliers[":id"].payments.$post({ param: { id }, json })),
      onSuccess: invalidate,
    }),
  };
}
