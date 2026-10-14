"use client";

import { useTranslations } from "next-intl";
import { useDateFormat, useMoney, useSettings } from "@/hooks/use-settings";
import type { Sale } from "./api";

/** 80mm thermal-printer friendly receipt. */
export function Receipt({ sale }: { sale: Sale }) {
  const t = useTranslations("receipt");
  const tp = useTranslations("pos");
  const money = useMoney();
  const dates = useDateFormat();
  const { data: settings } = useSettings();

  return (
    <div className="mx-auto w-[72mm] bg-white p-2 font-mono text-[11px] leading-snug text-black">
      <div className="text-center">
        <div className="text-sm font-bold">{settings?.storeName}</div>
        {settings?.address && <div>{settings.address}</div>}
        {settings?.phone && <div dir="ltr">{settings.phone}</div>}
      </div>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between">
        <span>{t("saleNo", { id: sale.id })}</span>
        <span>{dates.dateTime(sale.createdAt)}</span>
      </div>
      {sale.cashierName && <div>{t("cashier", { name: sale.cashierName })}</div>}
      {sale.status === "voided" && (
        <div className="mt-1 text-center text-sm font-bold">*** {t("voided")} ***</div>
      )}
      <div className="my-2 border-t border-dashed border-black" />
      <table className="w-full">
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="pe-1">
                <div>{item.productName}</div>
                <div className="text-[10px]">
                  {item.quantity} × {money.format(item.unitPrice)}
                  {item.discount > 0 && ` (−${money.format(item.discount)})`}
                </div>
              </td>
              <td className="text-end whitespace-nowrap">{money.format(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="my-2 border-t border-dashed border-black" />
      <div className="flex justify-between">
        <span>{tp("subtotal")}</span>
        <span>{money.format(sale.subtotal)}</span>
      </div>
      {sale.discount > 0 && (
        <div className="flex justify-between">
          <span>{tp("discount")}</span>
          <span>−{money.format(sale.discount)}</span>
        </div>
      )}
      <div className="flex justify-between text-sm font-bold">
        <span>{tp("total")}</span>
        <span>{money.format(sale.total)}</span>
      </div>
      <div className="flex justify-between">
        <span>{tp(sale.paymentMethod)}</span>
        <span>{money.format(sale.amountPaid)}</span>
      </div>
      {sale.changeDue > 0 && (
        <div className="flex justify-between">
          <span>{tp("change")}</span>
          <span>{money.format(sale.changeDue)}</span>
        </div>
      )}
      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center">{settings?.receiptFooter || t("thankYou")}</div>
    </div>
  );
}
