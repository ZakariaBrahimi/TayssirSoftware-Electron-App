"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { useLocale } from "next-intl";
import { useCallback } from "react";
import { api, unwrap } from "@/lib/api-client";
import { formatMoney, toMajor, toMinor } from "@/lib/money";
import { toQuery } from "@/lib/query-string";
import type {
  AuditListQuery,
  PlatformDeviceListQuery,
  PlatformLicenseCreateInput,
  PlatformLicenseListQuery,
  PlatformLicenseUpdateInput,
  PlatformPaymentInput,
  PlatformPaymentListQuery,
  PlatformSettingsInput,
  PlanInput,
  PlanUpdateInput,
  PlatformStoreListQuery,
  RequestListQuery,
  SubscriptionInput,
} from "@/lib/validators/platform";

const p = api.platform;

export type PlatformMe = InferResponseType<typeof p.me.$get, 200>;
export type Overview = InferResponseType<typeof p.overview.$get, 200>;
export type StorePage = InferResponseType<typeof p.stores.$get, 200>;
export type StoreDetail = InferResponseType<(typeof p.stores)[":id"]["$get"], 200>;
export type LicensePage = InferResponseType<typeof p.licenses.$get, 200>;
export type LicenseDetail = InferResponseType<(typeof p.licenses)[":id"]["$get"], 200>;
export type DevicePage = InferResponseType<typeof p.devices.$get, 200>;
export type PaymentPage = InferResponseType<typeof p.payments.$get, 200>;
export type AuditPage = InferResponseType<typeof p.audit.$get, 200>;
export type PlatformSettings = InferResponseType<typeof p.settings.$get, 200>;
export type PlatformPlan = InferResponseType<typeof p.plans.$get, 200>[number];
export type RequestPage = InferResponseType<typeof p.requests.$get, 200>;
export type RequestDetail = InferResponseType<(typeof p.requests)[":id"]["$get"], 200>;

export function usePlatformMe() {
  return useQuery({
    queryKey: ["platform", "me"],
    queryFn: () => unwrap(p.me.$get()),
    retry: false,
    staleTime: 60_000,
  });
}

/** Money in the platform currency (payments, revenue). */
export function usePlatformMoney() {
  const currency = usePlatformMe().data?.currency ?? "DZD";
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

export function useOverview() {
  return useQuery({
    queryKey: ["platform", "overview"],
    queryFn: () => unwrap(p.overview.$get()),
  });
}

export function useStores(query: PlatformStoreListQuery) {
  return useQuery({
    queryKey: ["platform", "stores", query],
    queryFn: () => unwrap(p.stores.$get({ query: toQuery(query) })),
    placeholderData: keepPreviousData,
  });
}

export function useStoreOptions(q: string, enabled = true) {
  return useQuery({
    queryKey: ["platform", "store-options", q],
    queryFn: () => unwrap(p.stores.options.$get({ query: toQuery({ q }) })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useStoreDetail(id: string) {
  return useQuery({
    queryKey: ["platform", "store", id],
    queryFn: () => unwrap(p.stores[":id"].$get({ param: { id } })),
  });
}

export function useLicenses(query: PlatformLicenseListQuery) {
  return useQuery({
    queryKey: ["platform", "licenses", query],
    queryFn: () => unwrap(p.licenses.$get({ query: toQuery(query) })),
    placeholderData: keepPreviousData,
  });
}

export function useLicenseOptions(q: string, enabled = true) {
  return useQuery({
    queryKey: ["platform", "license-options", q],
    queryFn: () => unwrap(p.licenses.options.$get({ query: toQuery({ q }) })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useLicenseDetail(id: string | null) {
  return useQuery({
    queryKey: ["platform", "license", id],
    queryFn: () => unwrap(p.licenses[":id"].$get({ param: { id: id! } })),
    enabled: Boolean(id),
  });
}

export function useDevices(query: PlatformDeviceListQuery) {
  return useQuery({
    queryKey: ["platform", "devices", query],
    queryFn: () => unwrap(p.devices.$get({ query: toQuery(query) })),
    placeholderData: keepPreviousData,
  });
}

export function usePayments(query: PlatformPaymentListQuery) {
  return useQuery({
    queryKey: ["platform", "payments", query],
    queryFn: () => unwrap(p.payments.$get({ query: toQuery(query) })),
    placeholderData: keepPreviousData,
  });
}

export function useAudit(query: AuditListQuery) {
  return useQuery({
    queryKey: ["platform", "audit", query],
    queryFn: () => unwrap(p.audit.$get({ query: toQuery(query) })),
    placeholderData: keepPreviousData,
  });
}

/** Every console change can affect any view: refresh them all. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["platform"] });
}

export function useStoreMutations(id: string) {
  const onSuccess = useInvalidate();
  const param = { id };
  return {
    subscription: useMutation({
      mutationFn: (json: SubscriptionInput) =>
        unwrap(p.stores[":id"].subscription.$put({ param, json })),
      onSuccess,
    }),
    extendTrial: useMutation({
      mutationFn: (days: number) =>
        unwrap(p.stores[":id"]["extend-trial"].$post({ param, json: { days } })),
      onSuccess,
    }),
    suspend: useMutation({
      mutationFn: (reason: string) =>
        unwrap(p.stores[":id"].suspend.$post({ param, json: { reason } })),
      onSuccess,
    }),
    reactivate: useMutation({
      mutationFn: () => unwrap(p.stores[":id"].reactivate.$post({ param })),
      onSuccess,
    }),
    resetPassword: useMutation({
      mutationFn: ({ userId, password }: { userId: string; password: string }) =>
        unwrap(
          p.stores[":id"].users[":userId"].password.$post({
            param: { id, userId },
            json: { password },
          }),
        ),
      onSuccess,
    }),
  };
}

export function useLicenseMutations() {
  const onSuccess = useInvalidate();
  return {
    create: useMutation({
      mutationFn: (json: PlatformLicenseCreateInput) => unwrap(p.licenses.$post({ json })),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, json }: { id: string; json: PlatformLicenseUpdateInput }) =>
        unwrap(p.licenses[":id"].$patch({ param: { id }, json })),
      onSuccess,
    }),
    revoke: useMutation({
      mutationFn: (id: string) => unwrap(p.licenses[":id"].revoke.$post({ param: { id } })),
      onSuccess,
    }),
    restore: useMutation({
      mutationFn: (id: string) => unwrap(p.licenses[":id"].restore.$post({ param: { id } })),
      onSuccess,
    }),
    reset: useMutation({
      mutationFn: (id: string) => unwrap(p.licenses[":id"].reset.$post({ param: { id } })),
      onSuccess,
    }),
    removeActivation: useMutation({
      mutationFn: ({ id, activationId }: { id: string; activationId: string }) =>
        unwrap(
          p.licenses[":id"].activations[":activationId"].$delete({ param: { id, activationId } }),
        ),
      onSuccess,
    }),
  };
}

export function useDeviceMutations() {
  const onSuccess = useInvalidate();
  return {
    revoke: useMutation({
      mutationFn: (id: string) => unwrap(p.devices[":id"].revoke.$post({ param: { id } })),
      onSuccess,
    }),
  };
}

export function usePaymentMutations() {
  const onSuccess = useInvalidate();
  return {
    record: useMutation({
      mutationFn: (json: PlatformPaymentInput) => unwrap(p.payments.$post({ json })),
      onSuccess,
    }),
    void: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) =>
        unwrap(p.payments[":id"].void.$post({ param: { id }, json: { reason } })),
      onSuccess,
    }),
  };
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ["platform", "settings"],
    queryFn: () => unwrap(p.settings.$get()),
  });
}

export function useSaveSettings() {
  const onSuccess = useInvalidate();
  return useMutation({
    mutationFn: (json: PlatformSettingsInput) => unwrap(p.settings.$put({ json })),
    onSuccess,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ["platform", "plans"],
    queryFn: () => unwrap(p.plans.$get()),
    staleTime: 60_000,
  });
}

/** Plan name for a code, in the interface language (falls back to the code). */
export function usePlatformPlanName() {
  const plans = usePlans().data;
  const locale = useLocale();
  return useCallback(
    (code: string | null | undefined) => {
      if (!code) return "—";
      const plan = plans?.find((x) => x.code === code);
      if (!plan) return code;
      return (locale === "fr" ? plan.nameFr : locale === "ar" ? plan.nameAr : plan.nameEn) || code;
    },
    [plans, locale],
  );
}

export function usePlanMutations() {
  const onSuccess = useInvalidate();
  return {
    create: useMutation({
      mutationFn: (json: PlanInput) => unwrap(p.plans.$post({ json })),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ code, json }: { code: string; json: PlanUpdateInput }) =>
        unwrap(p.plans[":code"].$put({ param: { code }, json })),
      onSuccess,
    }),
  };
}

export function useRequests(query: RequestListQuery) {
  return useQuery({
    queryKey: ["platform", "requests", query],
    queryFn: () => unwrap(p.requests.$get({ query: toQuery(query) })),
    placeholderData: keepPreviousData,
  });
}

export function useRequestDetail(id: string | null) {
  return useQuery({
    queryKey: ["platform", "request", id],
    queryFn: () => unwrap(p.requests[":id"].$get({ param: { id: id! } })),
    enabled: Boolean(id),
  });
}

export function useRequestMutations() {
  const onSuccess = useInvalidate();
  return {
    approve: useMutation({
      mutationFn: (id: string) => unwrap(p.requests[":id"].approve.$post({ param: { id } })),
      onSuccess,
    }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) =>
        unwrap(p.requests[":id"].reject.$post({ param: { id }, json: { reason } })),
      onSuccess,
    }),
  };
}
