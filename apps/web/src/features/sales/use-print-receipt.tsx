"use client";

import { useCallback } from "react";
import { usePrint } from "@/hooks/use-print";
import { useSettings } from "@/hooks/use-settings";
import { DEFAULT_RECEIPT_SETTINGS } from "@/lib/print-settings";
import type { Sale } from "./api";
import { ReceiptCopies, receiptPage, usePreloadReceiptLanguage } from "./receipt";

/** Prints a sale's receipt with the shop's design, paper and copies. */
export function usePrintReceipt() {
  const { print, printArea } = usePrint();
  const settings = useSettings().data?.receipt ?? DEFAULT_RECEIPT_SETTINGS;
  usePreloadReceiptLanguage();
  const printReceipt = useCallback(
    (sale: Sale) =>
      print(<ReceiptCopies sale={sale} copies={settings.copies} />, {
        page: receiptPage(settings),
      }),
    [print, settings],
  );
  return { printReceipt, printArea, settings };
}
