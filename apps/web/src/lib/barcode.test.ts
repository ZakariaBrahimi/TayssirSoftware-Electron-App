import { describe, expect, it } from "vitest";
import { barcodeSymbology, ean13CheckDigit, generateInternalEan13, isValidEan13 } from "./barcode";

describe("EAN-13", () => {
  it("computes the check digit of a known barcode", () => {
    // 4006381333931 is a well-known valid EAN-13
    expect(ean13CheckDigit("400638133393")).toBe(1);
    expect(isValidEan13("4006381333931")).toBe(true);
    expect(isValidEan13("4006381333932")).toBe(false);
  });

  it("generates valid in-store barcodes", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInternalEan13();
      expect(code).toMatch(/^2\d{12}$/);
      expect(isValidEan13(code)).toBe(true);
    }
  });

  it("picks a symbology", () => {
    expect(barcodeSymbology("4006381333931")).toBe("ean13");
    expect(barcodeSymbology("ABC-123")).toBe("code128");
  });
});
