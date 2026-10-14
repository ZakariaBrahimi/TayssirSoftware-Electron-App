"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { useLocale } from "next-intl";
import { useCallback } from "react";
import { api, unwrap } from "@/lib/api-client";
import { formatMoney, toMinor } from "@/lib/money";
import type { PaymentRequestInput } from "@/lib/validators/platform";

export type Subscription = InferResponseType<typeof api.subscription.$get, 200>;
export type Catalog = NonNullable<Subscription["catalog"]>;
export type CatalogPlan = Catalog["plans"][number];

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () => unwrap(api.subscription.$get()),
  });
}

export function useSubscriptionMutations() {
  const qc = useQueryClient();
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: ["subscription"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };
  return {
    send: useMutation({
      mutationFn: (json: PaymentRequestInput) => unwrap(api.subscription.requests.$post({ json })),
      onSuccess,
    }),
    cancel: useMutation({
      mutationFn: (id: string) =>
        unwrap(api.subscription.requests[":id"].cancel.$post({ param: { id } })),
      onSuccess,
    }),
  };
}

/** Plan name in the interface language. */
export function usePlanName() {
  const locale = useLocale() as "en" | "fr" | "ar";
  return useCallback(
    (plans: CatalogPlan[] | undefined, code: string | null | undefined) => {
      if (!code) return "—";
      const plan = plans?.find((p) => p.code === code);
      return plan ? plan.name[locale] || plan.name.en : code;
    },
    [locale],
  );
}

/** Catalog prices are whole units (e.g. dinars). */
export function useCatalogMoney(currency = "DZD") {
  const locale = useLocale();
  return {
    whole: (amount: number) =>
      formatMoney(toMinor(amount, currency), currency, locale).replace(/[.,]00(?=\D*$)/, ""),
    minor: (amount: number) => formatMoney(amount, currency, locale),
  };
}

/** Shrinks a photo so it fits in a request (JPEG, longest side 1600 px). */
export async function compressImage(file: File, maxSide = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.45]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length < 2_000_000) return data;
    }
    throw new Error("too_large");
  } finally {
    URL.revokeObjectURL(url);
  }
}
