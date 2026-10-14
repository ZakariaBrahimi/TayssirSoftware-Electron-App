import { z } from "zod";

/* Shared request schemas. Used by the API (validation) and by the UI (forms
 * and typed clients), and reusable by a future mobile app. */

const money = z.number().int().min(0).max(1_000_000_000_000);
const id = z.coerce.number().int().positive();

export const idParam = z.object({ id });

export const namedEntityInput = z.object({
  name: z.string().trim().min(1).max(80),
});
export type NamedEntityInput = z.infer<typeof namedEntityInput>;

export const barcodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9\-_.]+$/, "invalid_barcode");

export const productBase = z.object({
  name: z.string().trim().min(1).max(120),
  barcode: barcodeSchema,
  description: z.string().trim().max(1000).nullish(),
  costPrice: money,
  salePrice: money,
  lowStockThreshold: z.number().int().min(0).max(1_000_000).default(5),
  categoryId: z.number().int().positive().nullish(),
  brandId: z.number().int().positive().nullish(),
  isActive: z.boolean().default(true),
});

export const productCreateInput = productBase.extend({
  stock: z.number().int().min(0).max(10_000_000).default(0),
});
export type ProductCreateInput = z.infer<typeof productCreateInput>;

export const productUpdateInput = productBase.partial();
export type ProductUpdateInput = z.infer<typeof productUpdateInput>;

export const stockAdjustmentInput = z.object({
  change: z
    .number()
    .int()
    .refine((v) => v !== 0, "change_must_not_be_zero"),
  note: z.string().trim().max(200).optional(),
});
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentInput>;

export const PRODUCT_STOCK_FILTERS = ["all", "low", "out"] as const;
export const PRODUCT_SORTS = [
  "name",
  "-name",
  "stock",
  "-stock",
  "salePrice",
  "-salePrice",
  "createdAt",
  "-createdAt",
] as const;

export const productListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: id.optional(),
  brandId: id.optional(),
  stock: z.enum(PRODUCT_STOCK_FILTERS).default("all"),
  includeInactive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(PRODUCT_SORTS).default("name"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});
export type ProductListQuery = z.input<typeof productListQuery>;

export const PAYMENT_METHODS = ["cash", "card", "other"] as const;

export const saleCreateInput = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(100_000),
        discount: money.default(0),
      }),
    )
    .min(1)
    .max(500),
  discount: money.default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cash"),
  /** Amount handed over by the customer. Defaults to the total. */
  amountPaid: money.optional(),
  note: z.string().trim().max(500).optional(),
});
export type SaleCreateInput = z.input<typeof saleCreateInput>;

const isoDate = z.iso.datetime({ offset: true });

export const saleListQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(["completed", "voided"]).optional(),
  q: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});
export type SaleListQuery = z.input<typeof saleListQuery>;

export const reportQuery = z.object({
  from: isoDate,
  to: isoDate,
  /** Client's offset from UTC in minutes (e.g. +60 for UTC+1). */
  tzOffset: z.coerce
    .number()
    .int()
    .min(-14 * 60)
    .max(14 * 60)
    .default(0),
});
export type ReportQuery = z.input<typeof reportQuery>;

export const settingsInput = z.object({
  storeName: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300).nullish(),
  phone: z.string().trim().max(40).nullish(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  receiptFooter: z.string().trim().max(300).nullish(),
});
export type SettingsInput = z.infer<typeof settingsInput>;

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_.]+$/, "invalid_username");

export const setupInput = z.object({
  storeName: z.string().trim().min(1).max(120),
  currency: settingsInput.shape.currency,
  name: z.string().trim().min(1).max(80),
  username: usernameSchema,
  password: z.string().min(6).max(128),
});
export type SetupInput = z.infer<typeof setupInput>;
