"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { toQuery } from "@/lib/query-string";
import type { CustomerInput, PartyListQuery, PaymentInput } from "@/lib/validators";

export type CustomerPage = InferResponseType<typeof api.customers.$get, 200>;
export type Customer = InferResponseType<(typeof api.customers)[":id"]["$get"], 200>;
export type CustomerStatement = InferResponseType<
  (typeof api.customers)[":id"]["statement"]["$get"],
  200
>;
export type CustomerOption = InferResponseType<typeof api.customers.options.$get, 200>[number];

export function useCustomers(query: PartyListQuery) {
  return useQuery({
    queryKey: ["customers", "list", query],
    queryFn: () => unwrap(api.customers.$get({ query: toQuery(query) })),
    placeholderData: keepPreviousData,
  });
}

export function useCustomerOptions(q: string) {
  return useQuery({
    queryKey: ["customers", "options", q],
    queryFn: () => unwrap(api.customers.options.$get({ query: toQuery({ q }) })),
    placeholderData: keepPreviousData,
  });
}

export function useCustomerStatement(id: string) {
  return useQuery({
    queryKey: ["customers", "statement", id],
    queryFn: () => unwrap(api.customers[":id"].statement.$get({ param: { id } })),
  });
}

export function useCustomerMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["reports"] });
  };
  return {
    create: useMutation({
      mutationFn: (json: CustomerInput) => unwrap(api.customers.$post({ json })),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, json }: { id: string; json: CustomerInput }) =>
        unwrap(api.customers[":id"].$patch({ param: { id }, json })),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => unwrap(api.customers[":id"].$delete({ param: { id } })),
      onSuccess: invalidate,
    }),
    pay: useMutation({
      mutationFn: ({ id, json }: { id: string; json: PaymentInput }) =>
        unwrap(api.customers[":id"].payments.$post({ param: { id }, json })),
      onSuccess: () => {
        invalidate();
        qc.invalidateQueries({ queryKey: ["shifts"] });
      },
    }),
  };
}
