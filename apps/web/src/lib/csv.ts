/**
 * Minimal RFC 4180 CSV, compatible with Excel:
 * - output starts with a UTF-8 BOM so Excel shows Arabic/French correctly;
 * - input accepts "," or ";" separators (French Excel uses ";").
 */

const needsQuotes = /[",;\r\n]/;

export function toCsv(rows: (string | number | boolean | null | undefined)[][]) {
  const lines = rows.map((row) =>
    row
      .map((cell) => {
        const s = cell === null || cell === undefined ? "" : String(cell);
        return needsQuotes.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(","),
  );
  return `﻿${lines.join("\r\n")}\r\n`;
}

function detectSeparator(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  return count(";") > count(",") ? ";" : ",";
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const sep = detectSeparator(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Parses "1 234,50" / "1,234.50" / "1234.5" into a number (NaN if invalid). */
export function parseDecimal(value: string): number {
  let s = value.trim().replace(/[\s  ]/g, "");
  if (s === "") return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
