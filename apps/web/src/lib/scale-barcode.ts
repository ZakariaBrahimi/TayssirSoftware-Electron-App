/*
 * Label-scale barcodes (supermarket fruit and vegetables, butcher, cheese):
 * an EAN-13 starting with 2, made of
 *   2 · prefix digit · 5-digit item code · 5-digit value · check digit
 * The value is a weight in grams or a price, depending on how the scale is
 * set up (the store's "scale barcodes" setting).
 */

export function ean13CheckDigit(first12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function parseScaleBarcode(barcode: string): { code: string; value: number } | null {
  if (!/^2\d{12}$/.test(barcode)) return null;
  if (ean13CheckDigit(barcode.slice(0, 12)) !== Number(barcode[12])) return null;
  return {
    // Item codes are compared without leading zeros ("00123" = "123").
    code: String(Number(barcode.slice(2, 7))),
    value: Number(barcode.slice(7, 12)),
  };
}
