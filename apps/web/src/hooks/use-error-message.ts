"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { ApiError } from "@/lib/api-client";

/** Turns any thrown error into a translated, user-friendly message. */
export function useErrorMessage() {
  const t = useTranslations("errors");
  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiError) {
        const key = error.code as Parameters<typeof t>[0];
        if (error.code === "INSUFFICIENT_STOCK" && error.details?.name) {
          return t("INSUFFICIENT_STOCK_PRODUCT", {
            name: String(error.details.name),
            available: Number(error.details.available ?? 0),
          });
        }
        if (t.has(key)) return t(key);
      }
      return t("INTERNAL_ERROR");
    },
    [t],
  );
}
