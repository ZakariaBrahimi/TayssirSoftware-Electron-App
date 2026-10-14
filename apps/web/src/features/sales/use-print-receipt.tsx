"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast } from "sonner";
import { usePrint } from "@/hooks/use-print";
import { useSettings } from "@/hooks/use-settings";
import { isNativeApp } from "@/lib/native";
import { DEFAULT_RECEIPT_SETTINGS } from "@/lib/print-settings";
import { usePhonePrint } from "../printing/phone-printer";
import type { Sale } from "./api";
import { Receipt, ReceiptCopies, receiptPage, usePreloadReceiptLanguage } from "./receipt";

/**
 * Prints a sale's receipt with the shop's design, paper and copies: the
 * browser's print dialog, or the phone's Bluetooth / Sunmi printer in the
 * Android app.
 */
export function usePrintReceipt() {
  const t = useTranslations("printing");
  const { print, printArea } = usePrint();
  const { printOnPhone, phonePrintArea } = usePhonePrint();
  const settings = useSettings().data?.receipt ?? DEFAULT_RECEIPT_SETTINGS;
  usePreloadReceiptLanguage();

  const printReceipt = useCallback(
    (sale: Sale) => {
      if (!isNativeApp()) {
        print(<ReceiptCopies sale={sale} copies={settings.copies} />, {
          page: receiptPage(settings),
        });
        return;
      }
      // Thermal paper only on phones (A4 prints as 80 mm).
      const paper = settings.paper === "58" ? "58" : "80";
      printOnPhone(<Receipt sale={sale} settings={{ ...settings, paper }} />, {
        paper,
        copies: settings.copies,
      }).catch((err: Error) =>
        toast.error(err?.message === "NO_PRINTER" ? t("noPhonePrinter") : t("phonePrintFailed")),
      );
    },
    [print, printOnPhone, settings, t],
  );
  return {
    printReceipt,
    printArea: (
      <>
        {printArea}
        {phonePrintArea}
      </>
    ),
    settings,
  };
}
