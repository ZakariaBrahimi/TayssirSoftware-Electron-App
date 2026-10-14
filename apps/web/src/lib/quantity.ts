/*
 * Quantities: whole pieces, or weights / volumes / lengths with up to 3
 * decimals (0.750 kg). Stored as plain numbers: SQLite keeps 0.75 exactly
 * as written, even in columns declared as integer.
 */

export const UNITS = ["piece", "kg", "g", "l", "m"] as const;
export type Unit = (typeof UNITS)[number];

/** Units sold in fractions (weighed or measured). */
export const isMeasured = (unit: string | null | undefined) =>
  unit !== undefined && unit !== null && unit !== "piece";

/** Rounds to 3 decimals (gram / millilitre / millimetre precision). */
export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** True when the value has at most 3 decimals. */
export const hasAtMost3Decimals = (n: number) => Math.abs(round3(n) - n) < 1e-9;

/** Price of a quantity, in minor units (whole centimes). */
export const lineAmount = (unitPrice: number, quantity: number) => Math.round(unitPrice * quantity);

/** "3", "0.75", "1.5" in the given locale (no trailing zeros). */
export function formatQuantity(quantity: number, locale?: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(quantity);
}

/** Short unit symbols, the same in every language (kg, g, L, m). */
export const UNIT_SYMBOLS: Record<Unit, string> = {
  piece: "",
  kg: "kg",
  g: "g",
  l: "L",
  m: "m",
};

/** "0.75 kg", "2.5 m", "3" (pieces have no symbol). */
export function formatWithUnit(quantity: number, unit: string | null | undefined, locale?: string) {
  const symbol = UNIT_SYMBOLS[(unit ?? "piece") as Unit] ?? "";
  const n = formatQuantity(quantity, locale);
  return symbol ? `${n} ${symbol}` : n;
}

/** Step for +/- buttons: 1 piece, 100 g, 0.1 kg / L / m. */
export const quantityStep = (unit: string | null | undefined) =>
  unit === "g" ? 100 : isMeasured(unit) ? 0.1 : 1;
