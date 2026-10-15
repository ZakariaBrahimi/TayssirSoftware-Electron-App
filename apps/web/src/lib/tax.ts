/*
 * VAT, when a store charges it. Prices are VAT-inclusive (as shown on the
 * shelf), so VAT is extracted from amounts rather than added on top.
 * Amounts are integer minor units; rates are percents (up to 2 decimals).
 */

/** VAT included in a VAT-inclusive amount. */
export function includedTax(amount: number, rate: number) {
  return rate > 0 ? Math.round((amount * rate) / (100 + rate)) : 0;
}

/**
 * Splits `total` over parts in proportion to `weights`, in whole units that
 * add up exactly (largest remainders get the leftover units).
 */
export function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (!total || !sum) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((s, p) => s + p, 0);
  const order = exact
    .map((e, i) => ({ i, rest: e - Math.floor(e) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i]++;
    left--;
  }
  return parts;
}

export type TaxLine = { taxRate: number; lineTotal: number; taxAmount: number };

/** VAT summary by rate: amount before VAT, VAT, total including VAT. */
export function taxBreakdown(lines: TaxLine[], ticketDiscount = 0) {
  const discounts = allocate(
    ticketDiscount,
    lines.map((l) => l.lineTotal),
  );
  const byRate = new Map<number, { rate: number; base: number; tax: number; total: number }>();
  lines.forEach((l, i) => {
    if (l.taxRate <= 0 && l.taxAmount <= 0) return;
    const total = l.lineTotal - discounts[i];
    const row = byRate.get(l.taxRate) ?? { rate: l.taxRate, base: 0, tax: 0, total: 0 };
    row.total += total;
    row.tax += l.taxAmount;
    row.base = row.total - row.tax;
    byRate.set(l.taxRate, row);
  });
  return [...byRate.values()].sort((a, b) => b.rate - a.rate);
}

/** "19 %" / "9,5 %" style label. */
export const formatRate = (rate: number, locale?: string) =>
  `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(rate)} %`;
