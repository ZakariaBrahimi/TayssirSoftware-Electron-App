import { describe, expect, it } from "vitest";
import { currencyDigits, formatMoney, toMajor, toMinor } from "./money";

describe("money", () => {
  it("converts between major and minor units without float errors", () => {
    expect(toMinor(0.1 + 0.2, "DZD")).toBe(30);
    expect(toMinor(19.99, "EUR")).toBe(1999);
    expect(toMajor(1999, "EUR")).toBe(19.99);
    expect(toMinor(500, "JPY")).toBe(500);
  });

  it("knows the digits of a currency", () => {
    expect(currencyDigits("USD")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
  });

  it("formats amounts", () => {
    expect(formatMoney(123450, "USD", "en-US")).toBe("$1,234.50");
  });
});
