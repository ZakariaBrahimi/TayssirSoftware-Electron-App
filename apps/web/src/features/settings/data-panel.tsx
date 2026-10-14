"use client";

import { Download, FileUp, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PlanNotice } from "@/components/plan-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useCurrency } from "@/hooks/use-settings";
import { toCsv } from "@/lib/csv";
import { type ImportReport, importProductsCsv } from "./api";

const TEMPLATE = toCsv([
  [
    "name",
    "barcode",
    "category",
    "brand",
    "cost_price",
    "sale_price",
    "stock",
    "low_stock_threshold",
    "unit",
    "vat_rate",
    "family",
    "option_1",
    "value_1",
    "option_2",
    "value_2",
  ],
  [
    "Sugar 1kg",
    "6130000000017",
    "Grocery",
    "Cevital",
    "90",
    "110",
    "20",
    "5",
    "piece",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  [
    "Tomatoes",
    "2000000000011",
    "Vegetables",
    "",
    "80",
    "120",
    "25.5",
    "5",
    "kg",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
  [
    "T-shirt",
    "TS-S-BLK",
    "Men",
    "",
    "800",
    "1500",
    "4",
    "2",
    "piece",
    "",
    "T-shirt",
    "Size",
    "S",
    "Colour",
    "Black",
  ],
  [
    "T-shirt",
    "TS-M-BLK",
    "Men",
    "",
    "800",
    "1500",
    "3",
    "2",
    "piece",
    "",
    "T-shirt",
    "Size",
    "M",
    "Colour",
    "Black",
  ],
]);

export function DataPanel() {
  const t = useTranslations("settings");
  const ti = useTranslations("importErrors");
  const currency = useCurrency();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  const exports = [
    { label: t("exportProducts"), href: "/api/data/export/products" },
    { label: t("exportCustomers"), href: "/api/data/export/customers" },
    // The server exports the last 12 months when no period is given.
    { label: t("exportSales"), href: "/api/data/export/sales" },
  ];

  const analyse = async (picked: File) => {
    const text = await picked.text();
    setFile({ name: picked.name, text });
    setBusy(true);
    try {
      setReport(await importProductsCsv(text, true));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await importProductsCsv(file.text, false);
      if (result.errors.length) setReport(result);
      else {
        toast.success(t("imported"));
        setFile(null);
        setReport(null);
        qc.invalidateQueries({ queryKey: ["products"] });
        qc.invalidateQueries({ queryKey: ["categories"] });
        qc.invalidateQueries({ queryKey: ["brands"] });
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const errorText = (message: string) => {
    const [code, detail] = message.split(":");
    const key = code as Parameters<typeof ti>[0];
    return `${ti.has(key) ? ti(key) : code}${detail ? ` (${detail})` : ""}`;
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("exportTitle")}</CardTitle>
          <CardDescription>{t("exportDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {exports.map((e) => (
            <Button key={e.href} variant="outline" asChild>
              <a href={e.href} download>
                <Download />
                {e.label}
              </a>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("importTitle")}</CardTitle>
          <CardDescription>{t("importDescription", { currency })}</CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-2xl gap-4">
          <PlanNotice feature="import" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              <FileUp />
              {file ? file.name : t("chooseFile")}
            </Button>
            <Button variant="link" asChild>
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
                download="products-template.csv"
              >
                {t("downloadTemplate")}
              </a>
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) void analyse(picked);
                e.target.value = "";
              }}
            />
          </div>
          {report && (
            <div className="grid gap-3 rounded-lg border p-4 text-sm">
              {report.errors.length === 0 ? (
                <>
                  <p>{t("preview", { created: report.created, updated: report.updated })}</p>
                  <Button onClick={commit} disabled={busy} className="justify-self-start">
                    {busy && <Loader2 className="animate-spin" />}
                    {t("importNow")}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-destructive font-medium">
                    {t("importErrors", { count: report.errors.length })}
                  </p>
                  <ul className="text-destructive max-h-48 list-disc overflow-y-auto ps-5">
                    {report.errors.slice(0, 50).map((e) => (
                      <li key={`${e.line}-${e.message}`}>
                        {t("lineError", { line: e.line, message: errorText(e.message) })}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
