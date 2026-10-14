/**
 * Money helpers. Amounts are always handled as integers in the currency's
 * minor unit (e.g. 1250 = 12.50) to avoid floating point errors.
 */

const digitsCache = new Map<string, number>();

/** Number of minor-unit digits for a currency (2 for DZD/EUR/USD, 0 for JPY…). */
export function currencyDigits(currency: string): number {
  let digits = digitsCache.get(currency);
  if (digits === undefined) {
    try {
      digits =
        new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
          .maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    digitsCache.set(currency, digits);
  }
  return digits;
}

/** 12.5 -> 1250 (for a 2-digit currency) */
export function toMinor(major: number, currency: string): number {
  if (!Number.isFinite(major)) return 0;
  return Math.round(major * 10 ** currencyDigits(currency));
}

/** 1250 -> 12.5 (for a 2-digit currency) */
export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** currencyDigits(currency);
}

export function formatMoney(minor: number, currency: string, locale = "en"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(toMajor(minor, currency));
  } catch {
    return `${toMajor(minor, currency).toFixed(2)} ${currency}`;
  }
}
