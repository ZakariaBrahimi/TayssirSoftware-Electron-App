"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";
import { toQuery } from "@/lib/query-string";
import type { CashMovementInput } from "@/lib/validators";

export type ShiftSummary = InferResponseType<(typeof api.shifts)[":id"]["$get"], 200>;
export type ShiftPage = InferResponseType<typeof api.shifts.$get, 200>;

export function useCurrentShift() {
  return useQuery({
    queryKey: ["shifts", "current"],
    queryFn: async () => (await unwrap(api.shifts.current.$get())).summary,
  });
}

export function useShift(id: string | null) {
  return useQuery({
    queryKey: ["shifts", "detail", id],
    queryFn: () => unwrap(api.shifts[":id"].$get({ param: { id: id! } })),
    enabled: !!id,
  });
}

export function useShifts(page: number) {
  return useQuery({
    queryKey: ["shifts", "list", page],
    queryFn: () => unwrap(api.shifts.$get({ query: toQuery({ page, pageSize: 20 }) })),
    placeholderData: keepPreviousData,
  });
}

export function useShiftMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["shifts"] });
  return {
    open: useMutation({
      mutationFn: (openingCash: number) => unwrap(api.shifts.open.$post({ json: { openingCash } })),
      onSuccess: invalidate,
    }),
    close: useMutation({
      mutationFn: (json: { countedCash: number; note?: string }) =>
        unwrap(api.shifts.close.$post({ json })),
      onSuccess: invalidate,
    }),
    move: useMutation({
      mutationFn: (json: CashMovementInput) => unwrap(api.shifts.movements.$post({ json })),
      onSuccess: invalidate,
    }),
  };
}
