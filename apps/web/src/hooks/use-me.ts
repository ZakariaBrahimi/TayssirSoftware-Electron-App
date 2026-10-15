"use client";

import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, unwrap } from "@/lib/api-client";

export type Me = InferResponseType<typeof api.me.$get, 200>;
export type Entitlement = Me["entitlement"];

export const meQuery = {
  queryKey: ["me"] as const,
  queryFn: () => unwrap(api.me.$get()),
  staleTime: 60_000,
};

/** Signed-in user, store, deployment mode and license/subscription state. */
export function useMe() {
  return useQuery(meQuery);
}

export function useAppInfo() {
  return useQuery({
    queryKey: ["app-info"],
    queryFn: () => unwrap(api.app.$get()),
    staleTime: 0,
  });
}
