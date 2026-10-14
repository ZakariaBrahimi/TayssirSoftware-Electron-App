"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type AbstractIntlMessages,
  NextIntlClientProvider,
  useLocale,
  useTranslations,
} from "next-intl";
import { Barcode, QrCode } from "@/components/barcode";
import { useDateFormat, useMoney, useSettings } from "@/hooks/use-settings";
import {
  DEFAULT_RECEIPT_SETTINGS,
  type ReceiptPaper,
  type ReceiptSettings,
} from "@/lib/print-settings";
import { formatWithUnit, isMeasured } from "@/lib/quantity";
import { formatRate, taxBreakdown } from "@/lib/tax";
import { cn } from "@/lib/utils";
import type { Sale } from "./api";

/* Receipts follow the shop's design (Settings → Printing). */

const WIDTH: Record<ReceiptPaper, string> = { "80": "72mm", "58": "48mm", a4: "180mm" };
const FONT_PX: Record<ReceiptPaper, Record<"s" | "m" | "l", number>> = {
  "80": { s: 10, m: 11, l: 12.5 },
  "58": { s: 9, m: 10, l: 11 },
  a4: { s: 12, m: 13, l: 15 },
};

/** Paper for printing receipts. */
export function receiptPage(settings: ReceiptSettings) {
  return settings.paper === "a4" ? "size: A4; margin: 12mm;" : "margin: 0;";
}

/** Messages of another language, loaded once, for receipts printed in it. */
function useReceiptMessages(language: string) {
  return useQuery({
    queryKey: ["receipt-messages", language],
    queryFn: async () =>
      (await import(`@/messages/${language}.json`)).default as AbstractIntlMessages,
    enabled: language !== "ui",
    staleTime: Infinity,
  });
}

/** Renders the receipt in the language chosen for receipts. */
function ReceiptLanguage({ language, children }: { language: string; children: React.ReactNode }) {
  const locale = useLocale();
  const other = language !== "ui" && language !== locale ? language : "ui";
  const messages = useReceiptMessages(other);
  if (other === "ui" || !messages.data) return <>{children}</>;
  return (
    <NextIntlClientProvider
      locale={other as "fr" | "ar" | "en"}
      messages={messages.data}
      timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
}

/** Loads the receipt language ahead of a print (call it where receipts print). */
export function usePreloadReceiptLanguage() {
  const locale = useLocale();
  const language = useSettings().data?.receipt.language ?? "ui";
  useReceiptMessages(language !== "ui" && language !== locale ? language : "ui");
}

/** A sale receipt: thermal 58/80 mm, or an A4 invoice. */
export function Receipt({
  sale,
  settings,
  logo,
}: {
  sale: Sale;
  /** Overrides the saved design (live preview in Settings). */
  settings?: ReceiptSettings;
  logo?: string | null;
}) {
  const store = useSettings().data;
  const s = settings ?? store?.receipt ?? DEFAULT_RECEIPT_SETTINGS;
  return (
    <ReceiptLanguage language={s.language}>
      <ReceiptBody sale={sale} s={s} logo={logo !== undefined ? logo : (store?.logo ?? null)} />
    </ReceiptLanguage>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-between gap-2", className)}>
      <span>{label}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  );
}

function ReceiptBody({ sale, s, logo }: { sale: Sale; s: ReceiptSettings; logo: string | null }) {
  const t = useTranslations("receipt");
  const tp = useTranslations("pos");
  const tc = useTranslations("common");
  const ts = useTranslations("sales");
  const locale = useLocale();
  const money = useMoney();
  const dates = useDateFormat();
  const { data: store } = useSettings();
  const paid = Math.min(sale.amountPaid, sale.total);
  const vat = s.showTaxes && sale.taxTotal > 0 ? taxBreakdown(sale.items, sale.discount) : [];
  const itemCount = sale.items.reduce((n, i) => n + (isMeasured(i.unit) ? 1 : i.quantity), 0);
  const a4 = s.paper === "a4";
  const legal = [
    store?.taxEnabled && store.taxId && t("taxId", { id: store.taxId }),
    s.nis && t("nis", { id: s.nis }),
    s.rc && t("rc", { id: s.rc }),
    s.ai && t("ai", { id: s.ai }),
  ].filter(Boolean);
  const rule = <div className="my-2 border-t border-dashed border-black" />;

  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={cn("mx-auto bg-white p-2 text-black", a4 ? "font-sans" : "font-mono")}
      style={{
        width: WIDTH[s.paper],
        fontSize: `${FONT_PX[s.paper][s.fontSize]}px`,
        lineHeight: 1.35,
      }}
    >
      <div className={cn(a4 ? "flex items-start justify-between gap-4" : "text-center")}>
        <div className={cn(!a4 && "flex flex-col items-center")}>
          {s.showLogo && logo && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL, printed
            <img
              src={logo}
              alt=""
              className="mb-1 max-h-[18mm] max-w-[45mm] object-contain grayscale"
            />
          )}
          <div className={cn("font-bold", a4 ? "text-[1.6em]" : "text-[1.25em]")}>
            {store?.name}
          </div>
          {s.headerText && <div>{s.headerText}</div>}
          {s.showAddress && store?.address && <div>{store.address}</div>}
          {s.showPhone && store?.phone && <div dir="ltr">{store.phone}</div>}
          {legal.map((line) => (
            <div key={String(line)} className="text-[0.9em]">
              {line}
            </div>
          ))}
        </div>
        {a4 && (
          <div className="text-end">
            <div className="text-[1.4em] font-bold">{t("invoice")}</div>
            <div>{t("saleNo", { id: sale.number })}</div>
            <div>{dates.dateTime(sale.createdAt)}</div>
          </div>
        )}
      </div>
      {!a4 && rule}
      {!a4 && (
        <div className="flex justify-between gap-2">
          <span>{t("saleNo", { id: sale.number })}</span>
          <span>{dates.dateTime(sale.createdAt)}</span>
        </div>
      )}
      {a4 && <div className="my-3" />}
      {s.showCashier && sale.cashierName && <div>{t("cashier", { name: sale.cashierName })}</div>}
      {s.showCustomer && sale.customerName && (
        <div>
          {ts("customer")}: {sale.customerName}
        </div>
      )}
      {sale.status === "voided" && (
        <div className="mt-1 text-center text-[1.2em] font-bold">*** {t("voided")} ***</div>
      )}
      {rule}
      <table className="w-full border-collapse">
        {a4 && (
          <thead>
            <tr className="border-b border-black text-start">
              <th className="py-1 text-start">{ts("product")}</th>
              <th className="py-1 text-end">{tp("qty")}</th>
              <th className="py-1 text-end">{t("unitPrice")}</th>
              <th className="py-1 text-end">{tp("total")}</th>
            </tr>
          </thead>
        )}
        <tbody>
          {sale.items.map((item) =>
            a4 ? (
              <tr key={item.id} className="border-b border-black/20 align-top">
                <td className="py-1 pe-2">
                  {item.productName}
                  {s.showLineBarcode && item.barcode && (
                    <div className="font-mono text-[0.8em]">{item.barcode}</div>
                  )}
                </td>
                <td className="py-1 text-end whitespace-nowrap">
                  {formatWithUnit(item.quantity, item.unit)}
                </td>
                <td className="py-1 text-end whitespace-nowrap">{money.format(item.unitPrice)}</td>
                <td className="py-1 text-end whitespace-nowrap">
                  {money.format(item.lineTotal)}
                  {s.showDiscounts && item.discount > 0 && (
                    <div className="text-[0.8em]">−{money.format(item.discount)}</div>
                  )}
                </td>
              </tr>
            ) : (
              <tr key={item.id} className="align-top">
                <td className="pe-1">
                  <div>{item.productName}</div>
                  <div className="text-[0.9em]">
                    {formatWithUnit(item.quantity, item.unit)}
                    {s.showUnitPrice && ` × ${money.format(item.unitPrice)}`}
                    {s.showDiscounts && item.discount > 0 && ` (−${money.format(item.discount)})`}
                  </div>
                  {s.showLineBarcode && item.barcode && (
                    <div className="text-[0.85em]">{item.barcode}</div>
                  )}
                </td>
                <td className="text-end whitespace-nowrap">{money.format(item.lineTotal)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {rule}
      <div className={cn(a4 && "ms-auto w-1/2")}>
        <Row label={tp("subtotal")} value={money.format(sale.subtotal)} />
        {s.showDiscounts && sale.discount > 0 && (
          <Row label={tp("discount")} value={`−${money.format(sale.discount)}`} />
        )}
        <Row
          label={tp("total")}
          value={money.format(sale.total)}
          className="text-[1.25em] font-bold"
        />
        {s.showItemCount && <Row label={t("itemCount")} value={itemCount} />}
        {vat.length > 0 && (
          <div className="my-1 text-[0.9em]">
            {vat.map((row) => (
              <Row
                key={row.rate}
                label={t("vatLine", { rate: formatRate(row.rate), base: money.format(row.base) })}
                value={money.format(row.tax)}
              />
            ))}
            <Row label={t("vatIncluded")} value={money.format(sale.taxTotal)} />
          </div>
        )}
        <Row
          label={tc(sale.paymentMethod === "credit" ? "credit" : sale.paymentMethod)}
          value={money.format(sale.paymentMethod === "credit" ? paid : sale.amountPaid)}
        />
        {sale.changeDue > 0 && <Row label={tp("change")} value={money.format(sale.changeDue)} />}
        {sale.balanceDue > 0 && (
          <Row
            label={tp("onAccount")}
            value={money.format(sale.balanceDue)}
            className="font-bold"
          />
        )}
        {sale.refundedAmount > 0 && (
          <Row label={ts("refunded")} value={`−${money.format(sale.refundedAmount)}`} />
        )}
      </div>
      {rule}
      {s.returnPolicy && <div className="mb-1 text-center text-[0.9em]">{s.returnPolicy}</div>}
      <div className="text-center">{store?.receiptFooter || t("thankYou")}</div>
      {(s.qrUrl || s.showReceiptBarcode) && (
        <div className="mt-2 flex items-end justify-center gap-4">
          {s.qrUrl && (
            <div className="flex flex-col items-center gap-0.5">
              <QrCode value={s.qrUrl} sizeMm={a4 ? 22 : 18} />
              {s.qrLabel && <div className="text-[0.85em]">{s.qrLabel}</div>}
            </div>
          )}
          {s.showReceiptBarcode && (
            <Barcode value={sale.number} heightMm={8} className="w-[38mm]" />
          )}
        </div>
      )}
    </div>
  );
}

/** One print job with the number of copies set in the receipt design. */
export function ReceiptCopies({ sale, copies }: { sale: Sale; copies: number }) {
  return (
    <>
      {Array.from({ length: copies }, (_, i) => (
        <div key={i} style={{ breakAfter: i < copies - 1 ? "page" : "auto" }}>
          <Receipt sale={sale} />
        </div>
      ))}
    </>
  );
}
