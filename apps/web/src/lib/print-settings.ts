import { z } from "zod";

/*
 * Designs of the barcode labels and the sale receipts, set once per shop
 * (Settings → Printing) and saved with the store, so every till and the
 * desktop app print the same thing.
 */

const mm = (min: number, max: number) => z.number().min(min).max(max);
const text = (max: number) => z.string().trim().max(max).default("");
const FONT_SIZES = ["s", "m", "l"] as const;
export type FontSize = (typeof FONT_SIZES)[number];

/* --------------------------------- Labels --------------------------------- */

/** Common label-roll sizes (width × height, mm). */
export const LABEL_ROLLS = [
  { id: "50x30", width: 50, height: 30 },
  { id: "40x30", width: 40, height: 30 },
  { id: "58x40", width: 58, height: 40 },
  { id: "38x25", width: 38, height: 25 },
] as const;

/** A4 sticker sheets (columns × rows). */
export const LABEL_SHEETS = [
  { id: "a4-3x8", columns: 3, rows: 8 },
  { id: "a4-3x7", columns: 3, rows: 7 },
  { id: "a4-4x10", columns: 4, rows: 10 },
  { id: "a4-2x7", columns: 2, rows: 7 },
] as const;

export const labelSettingsSchema = z.object({
  /** A roll of labels (thermal label printer) or A4 sticker sheets. */
  layout: z.enum(["roll", "sheet"]).default("roll"),
  width: mm(20, 120).default(50),
  height: mm(15, 120).default(30),
  columns: z.number().int().min(1).max(6).default(3),
  rows: z.number().int().min(1).max(20).default(8),
  /** A4 page margin and space between labels. */
  pageMargin: mm(0, 20).default(8),
  gap: mm(0, 10).default(2),
  showShopName: z.boolean().default(false),
  showName: z.boolean().default(true),
  nameLines: z.union([z.literal(1), z.literal(2)]).default(1),
  /** Size/colour on its own line (product variants). */
  showVariant: z.boolean().default(true),
  showPrice: z.boolean().default(true),
  /** Price per kg / L for weighed products. */
  showUnitPrice: z.boolean().default(true),
  /** "TTC" next to the price when the shop charges VAT. */
  showTaxNote: z.boolean().default(false),
  showCategory: z.boolean().default(false),
  showBrand: z.boolean().default(false),
  showBarcode: z.boolean().default(true),
  showBarcodeText: z.boolean().default(true),
  showDate: z.boolean().default(false),
  fontSize: z.enum(FONT_SIZES).default("m"),
  bigPrice: z.boolean().default(true),
  barcodeHeight: mm(5, 40).default(10),
  align: z.enum(["center", "start"]).default("center"),
  border: z.boolean().default(false),
});
export type LabelSettings = z.output<typeof labelSettingsSchema>;
export const DEFAULT_LABEL_SETTINGS: LabelSettings = labelSettingsSchema.parse({});

/** Size of one label in mm (sheets divide the A4 page). */
export function labelSize(s: LabelSettings) {
  if (s.layout === "roll") return { width: s.width, height: s.height };
  return {
    width: (210 - 2 * s.pageMargin - (s.columns - 1) * s.gap) / s.columns,
    height: (297 - 2 * s.pageMargin - (s.rows - 1) * s.gap) / s.rows,
  };
}

/* -------------------------------- Receipts -------------------------------- */

export const RECEIPT_PAPERS = ["80", "58", "a4"] as const;
export type ReceiptPaper = (typeof RECEIPT_PAPERS)[number];

export const receiptSettingsSchema = z.object({
  paper: z.enum(RECEIPT_PAPERS).default("80"),
  fontSize: z.enum(FONT_SIZES).default("m"),
  /** Language printed on receipts ("ui": the screen's language). */
  language: z.enum(["ui", "fr", "ar", "en"]).default("ui"),
  showLogo: z.boolean().default(true),
  showAddress: z.boolean().default(true),
  showPhone: z.boolean().default(true),
  /** A line under the shop name (e.g. "Open 7/7"). */
  headerText: text(120),
  /** Legal identifiers printed in the header (NIF is in the VAT settings). */
  nis: text(40),
  rc: text(40),
  ai: text(40),
  showCashier: z.boolean().default(true),
  showCustomer: z.boolean().default(true),
  showLineBarcode: z.boolean().default(false),
  showUnitPrice: z.boolean().default(true),
  showDiscounts: z.boolean().default(true),
  showTaxes: z.boolean().default(true),
  showItemCount: z.boolean().default(false),
  /** Return/exchange policy printed above the footer. */
  returnPolicy: text(300),
  /** A link printed as a QR code (website, Instagram, WhatsApp...). */
  qrUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || /^(https?:\/\/|wa\.me\/|tel:)/i.test(v), "invalid_url")
    .default(""),
  qrLabel: text(60),
  /** Barcode of the receipt number: scanning it opens the sale (returns). */
  showReceiptBarcode: z.boolean().default(true),
  /** After a sale: ask (show the receipt), print right away, or don't print. */
  autoPrint: z.enum(["ask", "always", "never"]).default("ask"),
  copies: z.number().int().min(1).max(3).default(1),
});
export type ReceiptSettings = z.output<typeof receiptSettingsSchema>;
export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = receiptSettingsSchema.parse({});

export const printSettingsInput = z.object({
  labels: labelSettingsSchema,
  receipt: receiptSettingsSchema,
  /** Small logo for receipts as a data URL (resized in the browser); null removes it. */
  logo: z
    .string()
    .max(200_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "invalid_image")
    .nullable()
    .optional(),
});
export type PrintSettingsInput = z.input<typeof printSettingsInput>;

/** Reads stored JSON, falling back to the defaults for anything missing or invalid. */
export function parseLabelSettings(json: string | null | undefined): LabelSettings {
  return parseWith(labelSettingsSchema, json, DEFAULT_LABEL_SETTINGS);
}
export function parseReceiptSettings(json: string | null | undefined): ReceiptSettings {
  return parseWith(receiptSettingsSchema, json, DEFAULT_RECEIPT_SETTINGS);
}
function parseWith<T>(schema: z.ZodType<T>, json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

/** Receipt numbers look like "KQM-42": the pattern a scanned receipt barcode has. */
export const RECEIPT_NUMBER = /^[A-Z0-9]{2,8}-\d{1,9}$/;
