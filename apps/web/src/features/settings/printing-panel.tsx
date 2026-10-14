"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Loader2, Printer, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useErrorMessage } from "@/hooks/use-error-message";
import { usePrint } from "@/hooks/use-print";
import type { StoreSettings } from "@/hooks/use-settings";
import { api, unwrap } from "@/lib/api-client";
import {
  LABEL_ROLLS,
  LABEL_SHEETS,
  type LabelSettings,
  RECEIPT_PAPERS,
  type ReceiptSettings,
} from "@/lib/print-settings";
import { cn } from "@/lib/utils";
import { type LabelItem, LabelPages, LabelView, labelPage } from "../printing/label";
import type { Sale } from "../sales/api";
import { PhonePrinterCard } from "../printing/phone-printer-card";
import { Receipt, receiptPage } from "../sales/receipt";

/* Settings → Printing: the shop's label and receipt designs, with previews. */

const SAMPLE_LABEL: LabelItem = {
  name: "T-shirt Basic — M / Black",
  familyName: "T-shirt Basic",
  barcode: "6130000000014",
  salePrice: 150000,
  unit: "piece",
  categoryName: "Men",
  brandName: "Mizan",
};

function sampleSale(): Sale {
  const items = [
    {
      name: "T-shirt Basic — M / Black",
      barcode: "6130000000014",
      qty: 2,
      price: 150000,
      unit: "piece",
    },
    { name: "Tomatoes", barcode: "2000000000011", qty: 1.25, price: 12000, unit: "kg" },
    { name: "Mineral water 1.5L", barcode: "6130000000021", qty: 3, price: 4500, unit: "piece" },
  ].map((i, n) => ({
    id: `sample-${n}`,
    productId: null,
    productName: i.name,
    barcode: i.barcode,
    quantity: i.qty,
    unit: i.unit,
    unitPrice: i.price,
    unitCost: 0,
    discount: n === 0 ? 10000 : 0,
    lineTotal: Math.round(i.price * i.qty) - (n === 0 ? 10000 : 0),
    taxRate: 0,
    taxAmount: 0,
  }));
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  return {
    id: "sample",
    number: "ABC-128",
    createdAt: new Date().toISOString(),
    cashierName: "Karim",
    customerName: "Amina",
    status: "completed",
    items,
    subtotal,
    discount: 0,
    total: subtotal,
    taxTotal: 0,
    paymentMethod: "cash",
    amountPaid: subtotal + 3500,
    changeDue: 3500,
    balanceDue: 0,
    refundedAmount: 0,
  } as unknown as Sale;
}

/** Resizes an uploaded logo to at most 384 px wide (thermal printers are ~576 px). */
async function resizeLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, 384 / img.width, 192 / img.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          className={cn(suffix && "pe-9")}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
        />
        {suffix && (
          <span className="text-muted-foreground pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Choice<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PrintingPanel({ settings }: { settings: StoreSettings }) {
  const t = useTranslations("printing");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const { print, printArea } = usePrint();
  const [labels, setLabels] = useState<LabelSettings>(settings.labels);
  const [receipt, setReceipt] = useState<ReceiptSettings>(settings.receipt);
  const [logo, setLogo] = useState<string | null>(settings.logo);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sample] = useState(sampleSale);

  const setL = (patch: Partial<LabelSettings>) => setLabels((s) => ({ ...s, ...patch }));
  const setR = (patch: Partial<ReceiptSettings>) => setReceipt((s) => ({ ...s, ...patch }));

  const dirty =
    JSON.stringify(labels) !== JSON.stringify(settings.labels) ||
    JSON.stringify(receipt) !== JSON.stringify(settings.receipt) ||
    logo !== settings.logo;

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.settings.printing.$put({
          json: { labels, receipt, ...(logo !== settings.logo ? { logo } : {}) },
        }),
      ),
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      toast.success(tc("saved"));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const rollId = LABEL_ROLLS.find(
    (r) => r.width === labels.width && r.height === labels.height,
  )?.id;
  const sheetId = LABEL_SHEETS.find(
    (r) => r.columns === labels.columns && r.rows === labels.rows,
  )?.id;
  const labelToggles = [
    ["showShopName", t("showShopName")],
    ["showName", t("showName")],
    ["showVariant", t("showVariant")],
    ["showPrice", t("showPrice")],
    ["bigPrice", t("bigPrice")],
    ["showUnitPrice", t("showUnitPrice")],
    ["showTaxNote", t("showTaxNote")],
    ["showCategory", t("showCategory")],
    ["showBrand", t("showBrand")],
    ["showBarcode", t("showBarcode")],
    ["showBarcodeText", t("showBarcodeText")],
    ["showDate", t("showDate")],
    ["border", t("border")],
  ] as const;
  const receiptToggles = [
    ["showLogo", t("showLogo")],
    ["showAddress", t("showAddress")],
    ["showPhone", t("showPhone")],
    ["showCashier", t("showCashier")],
    ["showCustomer", t("showCustomer")],
    ["showUnitPrice", t("showLineUnitPrice")],
    ["showDiscounts", t("showDiscounts")],
    ["showLineBarcode", t("showLineBarcode")],
    ["showTaxes", t("showTaxes")],
    ["showItemCount", t("showItemCount")],
    ["showReceiptBarcode", t("showReceiptBarcode")],
  ] as const;
  const sizes = [
    { value: "s" as const, label: t("size_s") },
    { value: "m" as const, label: t("size_m") },
    { value: "l" as const, label: t("size_l") },
  ];

  return (
    <div className="grid gap-6">
      <PhonePrinterCard sample={sample} receipt={receipt} />
      {/* ------------------------------ Labels ------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>{t("labelsTitle")}</CardTitle>
          <CardDescription>{t("labelsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="grid content-start gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice
                id="label-layout"
                label={t("layout")}
                value={labels.layout}
                options={[
                  { value: "roll", label: t("layout_roll") },
                  { value: "sheet", label: t("layout_sheet") },
                ]}
                onChange={(layout) => setL({ layout })}
              />
              {labels.layout === "roll" ? (
                <Choice
                  id="label-roll"
                  label={t("labelSize")}
                  value={rollId ?? "custom"}
                  options={[
                    ...LABEL_ROLLS.map((r) => ({
                      value: r.id,
                      label: `${r.width} × ${r.height} mm`,
                    })),
                    { value: "custom", label: t("custom") },
                  ]}
                  onChange={(id) => {
                    const r = LABEL_ROLLS.find((x) => x.id === id);
                    if (r) setL({ width: r.width, height: r.height });
                  }}
                />
              ) : (
                <Choice
                  id="label-sheet"
                  label={t("sheet")}
                  value={sheetId ?? "custom"}
                  options={[
                    ...LABEL_SHEETS.map((r) => ({
                      value: r.id,
                      label: t("sheetOption", {
                        columns: r.columns,
                        rows: r.rows,
                        count: r.columns * r.rows,
                      }),
                    })),
                    { value: "custom", label: t("custom") },
                  ]}
                  onChange={(id) => {
                    const r = LABEL_SHEETS.find((x) => x.id === id);
                    if (r) setL({ columns: r.columns, rows: r.rows });
                  }}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {labels.layout === "roll" ? (
                <>
                  <NumberField
                    id="lw"
                    label={t("width")}
                    value={labels.width}
                    min={20}
                    max={120}
                    suffix="mm"
                    onChange={(width) => setL({ width })}
                  />
                  <NumberField
                    id="lh"
                    label={t("height")}
                    value={labels.height}
                    min={15}
                    max={120}
                    suffix="mm"
                    onChange={(height) => setL({ height })}
                  />
                </>
              ) : (
                <>
                  <NumberField
                    id="lc"
                    label={t("columns")}
                    value={labels.columns}
                    min={1}
                    max={6}
                    onChange={(columns) => setL({ columns })}
                  />
                  <NumberField
                    id="lr"
                    label={t("rows")}
                    value={labels.rows}
                    min={1}
                    max={20}
                    onChange={(rows) => setL({ rows })}
                  />
                  <NumberField
                    id="lm"
                    label={t("pageMargin")}
                    value={labels.pageMargin}
                    min={0}
                    max={20}
                    step={0.5}
                    suffix="mm"
                    onChange={(pageMargin) => setL({ pageMargin })}
                  />
                  <NumberField
                    id="lg"
                    label={t("gap")}
                    value={labels.gap}
                    min={0}
                    max={10}
                    step={0.5}
                    suffix="mm"
                    onChange={(gap) => setL({ gap })}
                  />
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Choice
                id="lf"
                label={t("fontSize")}
                value={labels.fontSize}
                options={sizes}
                onChange={(fontSize) => setL({ fontSize })}
              />
              <Choice
                id="la"
                label={t("align")}
                value={labels.align}
                options={[
                  { value: "center", label: t("align_center") },
                  { value: "start", label: t("align_start") },
                ]}
                onChange={(align) => setL({ align })}
              />
              <Choice
                id="ln"
                label={t("nameLines")}
                value={String(labels.nameLines) as "1" | "2"}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                ]}
                onChange={(v) => setL({ nameLines: v === "2" ? 2 : 1 })}
              />
              <NumberField
                id="lb"
                label={t("barcodeHeight")}
                value={labels.barcodeHeight}
                min={5}
                max={40}
                suffix="mm"
                onChange={(barcodeHeight) => setL({ barcodeHeight })}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {labelToggles.map(([key, label]) => (
                <Toggle
                  key={key}
                  id={`l-${key}`}
                  label={label}
                  checked={labels[key]}
                  onChange={(v) => setL({ [key]: v })}
                />
              ))}
            </div>
          </div>
          <div className="grid content-start gap-3">
            <span className="text-sm font-medium">{t("preview")}</span>
            <div className="bg-muted/50 flex min-h-40 items-center justify-center overflow-auto rounded-lg border p-4">
              <div className="shadow-sm">
                <LabelView item={SAMPLE_LABEL} settings={labels} />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                print(
                  <LabelPages settings={labels} items={[{ item: SAMPLE_LABEL, copies: 1 }]} />,
                  {
                    page: labelPage(labels),
                  },
                )
              }
            >
              <Printer />
              {t("testPrint")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------- Receipts ----------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>{t("receiptTitle")}</CardTitle>
          <CardDescription>{t("receiptDescription")}</CardDescription>
        </CardHeader>
        <CardContent
          className={cn("grid gap-6", receipt.paper !== "a4" && "xl:grid-cols-[1fr_auto]")}
        >
          <div className="grid content-start gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Choice
                id="rp"
                label={t("paper")}
                value={receipt.paper}
                options={RECEIPT_PAPERS.map((p) => ({ value: p, label: t(`paper_${p}`) }))}
                onChange={(paper) => setR({ paper })}
              />
              <Choice
                id="rf"
                label={t("fontSize")}
                value={receipt.fontSize}
                options={sizes}
                onChange={(fontSize) => setR({ fontSize })}
              />
              <Choice
                id="rl"
                label={t("language")}
                value={receipt.language}
                options={[
                  { value: "ui", label: t("language_ui") },
                  { value: "fr", label: "Français" },
                  { value: "ar", label: "العربية" },
                  { value: "en", label: "English" },
                ]}
                onChange={(language) => setR({ language })}
              />
              <Choice
                id="rc"
                label={t("copies")}
                value={String(receipt.copies) as "1" | "2" | "3"}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                ]}
                onChange={(v) => setR({ copies: Number(v) })}
              />
            </div>
            <Choice
              id="ra"
              label={t("autoPrint")}
              value={receipt.autoPrint}
              options={[
                { value: "ask", label: t("autoPrint_ask") },
                { value: "always", label: t("autoPrint_always") },
                { value: "never", label: t("autoPrint_never") },
              ]}
              onChange={(autoPrint) => setR({ autoPrint })}
            />

            <div className="grid gap-2">
              <span className="text-sm font-medium">{t("logo")}</span>
              <div className="flex flex-wrap items-center gap-3">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL preview
                  <img
                    src={logo}
                    alt=""
                    className="h-14 max-w-40 rounded border bg-white object-contain p-1"
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">{t("noLogo")}</span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      setLogo(await resizeLogo(file));
                    } catch {
                      toast.error(t("logoError"));
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImageUp />
                  {logo ? t("changeLogo") : t("uploadLogo")}
                </Button>
                {logo && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)}>
                    <Trash2 />
                    {tc("delete")}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="r-header" className="text-xs">
                  {t("headerText")}
                </Label>
                <Input
                  id="r-header"
                  maxLength={120}
                  value={receipt.headerText}
                  placeholder={t("headerTextPlaceholder")}
                  onChange={(e) => setR({ headerText: e.target.value })}
                />
              </div>
              {(["nis", "rc", "ai"] as const).map((key) => (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={`r-${key}`} className="text-xs">
                    {t(key)}
                  </Label>
                  <Input
                    id={`r-${key}`}
                    dir="ltr"
                    maxLength={40}
                    value={receipt[key]}
                    onChange={(e) => setR({ [key]: e.target.value })}
                  />
                </div>
              ))}
              <p className="text-muted-foreground self-end text-xs">{t("nifHint")}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {receiptToggles.map(([key, label]) => (
                <Toggle
                  key={key}
                  id={`r-${key}`}
                  label={label}
                  checked={receipt[key]}
                  onChange={(v) => setR({ [key]: v })}
                />
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="r-policy" className="text-xs">
                  {t("returnPolicy")}
                </Label>
                <Textarea
                  id="r-policy"
                  rows={2}
                  maxLength={300}
                  value={receipt.returnPolicy}
                  placeholder={t("returnPolicyPlaceholder")}
                  onChange={(e) => setR({ returnPolicy: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="r-qr" className="text-xs">
                  {t("qrUrl")}
                </Label>
                <Input
                  id="r-qr"
                  dir="ltr"
                  maxLength={300}
                  value={receipt.qrUrl}
                  placeholder="https://instagram.com/…"
                  onChange={(e) => setR({ qrUrl: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="r-qr-label" className="text-xs">
                  {t("qrLabel")}
                </Label>
                <Input
                  id="r-qr-label"
                  maxLength={60}
                  value={receipt.qrLabel}
                  placeholder={t("qrLabelPlaceholder")}
                  onChange={(e) => setR({ qrLabel: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="grid content-start gap-3">
            <span className="text-sm font-medium">{t("preview")}</span>
            <div className="bg-muted/50 max-h-[44rem] overflow-auto rounded-lg border p-4">
              <div className="mx-auto w-fit shadow-sm">
                <Receipt sale={sample} settings={receipt} logo={logo} />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                print(<Receipt sale={sample} settings={receipt} logo={logo} />, {
                  page: receiptPage(receipt),
                })
              }
            >
              <Printer />
              {t("testPrint")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="bg-background/95 sticky bottom-0 z-10 -mx-1 flex justify-end gap-2 border-t px-1 py-3 backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          disabled={!dirty || save.isPending}
          onClick={() => {
            setLabels(settings.labels);
            setReceipt(settings.receipt);
            setLogo(settings.logo);
          }}
        >
          {tc("cancel")}
        </Button>
        <Button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {tc("save")}
        </Button>
      </div>
      {printArea}
    </div>
  );
}
