"use client";

import { Barcode } from "@/components/barcode";
import { useDateFormat, useMoney, useSettings } from "@/hooks/use-settings";
import { type LabelSettings, labelSize } from "@/lib/print-settings";
import { isMeasured, UNIT_SYMBOLS, type Unit } from "@/lib/quantity";
import { cn } from "@/lib/utils";

/** What a label needs to know about a product. */
export type LabelItem = {
  name: string;
  barcode: string;
  salePrice: number;
  unit?: string | null;
  familyName?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  /** Price typed at the till: a zero price isn't printed. */
  openPrice?: boolean;
};

const NAME_PT = { s: 6.5, m: 8, l: 10 } as const;
const PRICE_PT = { s: 8, m: 10, l: 13 } as const;

/** Splits "T-shirt — M / Black" into the family name and the variant. */
function splitVariant(item: LabelItem) {
  const prefix = item.familyName ? `${item.familyName} — ` : null;
  if (prefix && item.name.startsWith(prefix)) {
    return { title: item.familyName!, variant: item.name.slice(prefix.length) };
  }
  return { title: item.name, variant: null };
}

/** One label, drawn to its real size in millimetres. */
export function LabelView({ item, settings: s }: { item: LabelItem; settings: LabelSettings }) {
  const money = useMoney();
  const dates = useDateFormat();
  const store = useSettings().data;
  const { width, height } = labelSize(s);
  const { title, variant } = splitVariant(item);
  const measured = isMeasured(item.unit);
  const nameText = s.showVariant ? title : item.name;
  const extra = [s.showCategory && item.categoryName, s.showBrand && item.brandName]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "flex flex-col justify-between overflow-hidden bg-white text-black",
        s.align === "center" ? "items-center text-center" : "items-start text-start",
        s.border && "border border-black",
      )}
      style={{
        width: `${width}mm`,
        height: `${height}mm`,
        padding: "1mm 1.5mm",
        fontSize: `${NAME_PT[s.fontSize]}pt`,
        lineHeight: 1.15,
        breakInside: "avoid",
      }}
    >
      <div className="w-full min-w-0">
        {s.showShopName && store?.name && (
          <div className="truncate text-[0.8em] tracking-wide uppercase">{store.name}</div>
        )}
        {s.showName && (
          <div className={cn("font-semibold", s.nameLines === 1 ? "truncate" : "line-clamp-2")}>
            {nameText}
          </div>
        )}
        {s.showVariant && variant && <div className="truncate text-[0.9em]">{variant}</div>}
        {extra && <div className="truncate text-[0.8em]">{extra}</div>}
      </div>
      {s.showPrice && !(item.openPrice && item.salePrice === 0) && (
        <div
          className="font-bold whitespace-nowrap"
          style={{ fontSize: `${PRICE_PT[s.fontSize] * (s.bigPrice ? 1.35 : 1)}pt` }}
        >
          {money.format(item.salePrice)}
          {measured && s.showUnitPrice && (
            <span className="text-[0.6em] font-normal"> / {UNIT_SYMBOLS[item.unit as Unit]}</span>
          )}
          {s.showTaxNote && store?.taxEnabled && (
            <span className="text-[0.55em] font-normal"> TTC</span>
          )}
        </div>
      )}
      {s.showBarcode && item.barcode && (
        <Barcode
          value={item.barcode}
          heightMm={s.barcodeHeight}
          showText={s.showBarcodeText}
          className="w-full"
        />
      )}
      {s.showDate && <div className="text-[0.7em]">{dates.date(new Date())}</div>}
    </div>
  );
}

/** Paper for a print job of labels. */
export function labelPage(s: LabelSettings) {
  return s.layout === "roll"
    ? `size: ${s.width}mm ${s.height}mm; margin: 0;`
    : "size: A4; margin: 0;";
}

/** All the labels of a print job: one per roll label, or A4 sheets. */
export function LabelPages({
  items,
  settings: s,
}: {
  items: { item: LabelItem; copies: number }[];
  settings: LabelSettings;
}) {
  const labels = items.flatMap(({ item, copies }) => Array.from({ length: copies }, () => item));
  if (s.layout === "roll") {
    return (
      <>
        {labels.map((item, i) => (
          <div key={i} style={{ breakAfter: i < labels.length - 1 ? "page" : "auto" }}>
            <LabelView item={item} settings={s} />
          </div>
        ))}
      </>
    );
  }
  const perPage = s.columns * s.rows;
  const pages = Array.from({ length: Math.ceil(labels.length / perPage) }, (_, p) =>
    labels.slice(p * perPage, (p + 1) * perPage),
  );
  return (
    <>
      {pages.map((page, p) => (
        <div
          key={p}
          style={{
            width: "210mm",
            height: "297mm",
            padding: `${s.pageMargin}mm`,
            display: "grid",
            gridTemplateColumns: `repeat(${s.columns}, 1fr)`,
            gridAutoRows: `${labelSize(s).height}mm`,
            gap: `${s.gap}mm`,
            boxSizing: "border-box",
            breakAfter: p < pages.length - 1 ? "page" : "auto",
          }}
        >
          {page.map((item, i) => (
            <LabelView key={i} item={item} settings={s} />
          ))}
        </div>
      ))}
    </>
  );
}
