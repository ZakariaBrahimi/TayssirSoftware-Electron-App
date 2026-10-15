"use client";

import { Bluetooth, Check, Loader2, Printer, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isNativeApp, nativePrinter, type PrinterDevice } from "@/lib/native";
import type { ReceiptSettings } from "@/lib/print-settings";
import type { Sale } from "../sales/api";
import { Receipt } from "../sales/receipt";
import { setPhonePrinter, usePhonePrint } from "./phone-printer";

const noop = () => () => {};

/** Settings → Printing, in the Android app: this phone's receipt printer. */
export function PhonePrinterCard({ sample, receipt }: { sample: Sale; receipt: ReceiptSettings }) {
  const t = useTranslations("printing");
  const native = useSyncExternalStore(noop, isNativeApp, () => false);
  const { printOnPhone, phonePrintArea, printer } = usePhonePrint();
  const [devices, setDevices] = useState<PrinterDevice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  if (!native) return null;

  const find = async () => {
    setLoading(true);
    try {
      setDevices((await nativePrinter()!.listPrinters()).devices);
    } catch {
      toast.error(t("bluetoothError"));
    } finally {
      setLoading(false);
    }
  };
  const paper = receipt.paper === "58" ? "58" : "80";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bluetooth className="size-5" />
          {t("phonePrinterTitle")}
        </CardTitle>
        <CardDescription>{t("phonePrinterDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm">
          {printer ? (
            <>
              {t("phonePrinterCurrent")} <span className="font-semibold">{printer.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{t("phonePrinterNone")}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void find()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {t("findPrinters")}
          </Button>
          {printer && (
            <Button
              variant="outline"
              disabled={testing}
              onClick={() => {
                setTesting(true);
                printOnPhone(<Receipt sale={sample} settings={{ ...receipt, paper }} />, { paper })
                  .then(() => toast.success(t("phonePrintOk")))
                  .catch(() => toast.error(t("phonePrintFailed")))
                  .finally(() => setTesting(false));
              }}
            >
              {testing ? <Loader2 className="animate-spin" /> : <Printer />}
              {t("testPrint")}
            </Button>
          )}
          {printer && (
            <Button variant="ghost" onClick={() => setPhonePrinter(null)}>
              {t("forgetPrinter")}
            </Button>
          )}
        </div>
        {devices && (
          <ul className="divide-y rounded-lg border">
            {devices.length === 0 && (
              <li className="text-muted-foreground p-3 text-sm">{t("noPairedPrinters")}</li>
            )}
            {devices.map((d) => (
              <li key={d.address}>
                <button
                  type="button"
                  className="hover:bg-accent flex w-full items-center justify-between gap-3 p-3 text-start text-sm"
                  onClick={() => {
                    setPhonePrinter(d);
                    toast.success(t("printerChosen", { name: d.name }));
                  }}
                >
                  <span>
                    <span className="font-medium">{d.name}</span>
                    <span className="text-muted-foreground ms-2 font-mono text-xs" dir="ltr">
                      {d.address}
                    </span>
                  </span>
                  {printer?.address === d.address && <Check className="text-primary size-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground text-xs">{t("phonePrinterHint")}</p>
      </CardContent>
      {phonePrintArea}
    </Card>
  );
}
