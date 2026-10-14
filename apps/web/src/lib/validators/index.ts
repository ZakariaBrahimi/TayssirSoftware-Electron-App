import { z } from "zod";
import { hasAtMost3Decimals, UNITS } from "@/lib/quantity";
import { SHOP_TYPES } from "@/lib/shop-types";

/** off, weight (grams) or price (whole currency units) in scale barcodes. */
export const SCALE_BARCODE_MODES = ["off", "weight", "price"] as const;
export type ScaleBarcodeMode = (typeof SCALE_BARCODE_MODES)[number];

/* Shared request schemas. Used by the API (validation) and by the UI (forms
 * and typed clients), and reusable by a future mobile app. */

const money = z.number().int().min(0).max(1_000_000_000_000);
/** Pieces or measured amounts (kg, L, m): positive, at most 3 decimals. */
const quantity = (max: number) =>
  z.number().positive().max(max).refine(hasAtMost3Decimals, "too_many_decimals");
/** Stock levels and alert levels: same precision, zero allowed. */
const stockAmount = (max: number) =>
  z.number().min(0).max(max).refine(hasAtMost3Decimals, "too_many_decimals");
const positiveMoney = money.min(1);
/** VAT rate in percent, e.g. 19 or 9.5. */
const taxRate = z
  .number()
  .min(0)
  .max(100)
  .refine((v) => Math.round(v * 100) === v * 100, "too_many_decimals");
const id = z.string().uuid();
const optionalText = (max: number) => z.string().trim().max(max).nullish();

export const idParam = z.object({ id });

const isoDate = z.iso.datetime({ offset: true });

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
};

const booleanQuery = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

/* --------------------------------- Catalog -------------------------------- */

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

export const PRODUCT_KINDS = ["product", "service"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const productBase = z.object({
  name: z.string().trim().min(1).max(120),
  barcode: barcodeSchema,
  /** Other barcodes the product may carry (another supplier, an import sticker). */
  extraBarcodes: z.array(barcodeSchema).max(20).optional(),
  description: optionalText(1000),
  costPrice: money,
  salePrice: money,
  lowStockThreshold: stockAmount(1_000_000).default(5),
  /** piece, or a measured unit sold in fractions (kg, g, L, m). */
  unit: z.enum(UNITS).default("piece"),
  /** Services (repairs, printing...) have no stock. */
  kind: z.enum(PRODUCT_KINDS).default("product"),
  /** The price is typed at the till; salePrice is the suggested price. */
  openPrice: z.boolean().default(false),
  /** Item code programmed in a label scale (scale barcodes), digits only. */
  scaleCode: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, "invalid_scale_code")
    .nullish()
    // Leading zeros don't matter: "00123" and "123" are the same code.
    .transform((v) => (v === undefined ? undefined : v ? String(Number(v)) : null)),
  /** VAT rate override; null uses the store's rate. */
  taxRate: taxRate.nullish(),
  categoryId: id.nullish(),
  brandId: id.nullish(),
  isActive: z.boolean().default(true),
});

export const productCreateInput = productBase.extend({
  stock: stockAmount(10_000_000).default(0),
});
export type ProductCreateInput = z.input<typeof productCreateInput>;

export const productUpdateInput = productBase.partial();
export type ProductUpdateInput = z.infer<typeof productUpdateInput>;

/* -------------------------------- Variants -------------------------------- */

const optionText = z.string().trim().min(1).max(30);

/** An option of a product family (Size, Colour...) and its values. */
export const familyOptionInput = z.object({
  name: optionText,
  values: z.array(optionText).min(1).max(60),
});
export type FamilyOptionInput = z.infer<typeof familyOptionInput>;

export const familyVariantInput = z.object({
  /** Set for variants that already exist (updates). */
  id: id.optional(),
  /** One value per option, in the options' order. */
  values: z.array(optionText).min(1).max(3),
  /** Left empty: an internal barcode is generated. */
  barcode: barcodeSchema.or(z.literal("")).nullish(),
  costPrice: money,
  salePrice: money,
  /** Opening stock of new variants (existing ones use stock adjustments). */
  stock: stockAmount(10_000_000).default(0),
  lowStockThreshold: stockAmount(1_000_000).default(5),
  isActive: z.boolean().default(true),
});
export type FamilyVariantInput = z.input<typeof familyVariantInput>;

export const familyInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: optionalText(1000),
    unit: z.enum(UNITS).default("piece"),
    categoryId: id.nullish(),
    brandId: id.nullish(),
    options: z.array(familyOptionInput).min(1).max(3),
    variants: z.array(familyVariantInput).min(1).max(300),
  })
  .superRefine((input, ctx) => {
    const names = input.options.map((o) => o.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "duplicate_option" });
    }
    input.options.forEach((o, i) => {
      const values = o.values.map((v) => v.toLowerCase());
      if (new Set(values).size !== values.length) {
        ctx.addIssue({
          code: "custom",
          path: ["options", i, "values"],
          message: "duplicate_value",
        });
      }
    });
    const combos = new Set<string>();
    const barcodes = new Set<string>();
    input.variants.forEach((v, i) => {
      const fits =
        v.values.length === input.options.length &&
        v.values.every((value, k) => input.options[k].values.includes(value));
      if (!fits) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", i, "values"],
          message: "invalid_variant",
        });
      }
      const key = v.values.join("\u0000").toLowerCase();
      if (combos.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", i, "values"],
          message: "duplicate_variant",
        });
      }
      combos.add(key);
      if (v.barcode) {
        if (barcodes.has(v.barcode)) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", i, "barcode"],
            message: "duplicate_barcode",
          });
        }
        barcodes.add(v.barcode);
      }
      if (v.salePrice < v.costPrice) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", i, "salePrice"],
          message: "price_below_cost",
        });
      }
    });
  });
export type FamilyInput = z.input<typeof familyInput>;
export type FamilyOutput = z.output<typeof familyInput>;

export const stockAdjustmentInput = z.object({
  change: z
    .number()
    .refine((v) => v !== 0, "change_must_not_be_zero")
    .refine(hasAtMost3Decimals, "too_many_decimals"),
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
  kind: z.enum(PRODUCT_KINDS).optional(),
  /** Only these products (server-side use: quick buttons). */
  ids: z.array(id).max(500).optional(),
  includeInactive: booleanQuery,
  sort: z.enum(PRODUCT_SORTS).default("name"),
  ...pagination,
});
export type ProductListQuery = z.input<typeof productListQuery>;

/* ---------------------------------- Sales --------------------------------- */

export const PAYMENT_METHODS = ["cash", "card", "other"] as const;
export const SALE_PAYMENT_METHODS = [...PAYMENT_METHODS, "credit"] as const;
export const REFUND_METHODS = [...PAYMENT_METHODS, "account"] as const;

export const saleCreateInput = z.object({
  items: z
    .array(
      z.object({
        productId: id,
        quantity: quantity(100_000),
        discount: money.default(0),
        /** Price typed at the till (open-price products only). */
        unitPrice: money.optional(),
      }),
    )
    .min(1)
    .max(500),
  discount: money.default(0),
  /** Required for credit sales and partial payments. */
  customerId: id.nullish(),
  paymentMethod: z.enum(SALE_PAYMENT_METHODS).default("cash"),
  /** Amount handed over by the customer. Defaults to the total. */
  amountPaid: money.optional(),
  note: z.string().trim().max(500).optional(),
});
export type SaleCreateInput = z.input<typeof saleCreateInput>;

export const saleListQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(["completed", "voided"]).optional(),
  customerId: id.optional(),
  /** Receipt number, e.g. "KQM-42" or just "42". */
  q: z.string().trim().max(30).optional(),
  ...pagination,
});
export type SaleListQuery = z.input<typeof saleListQuery>;

export const returnCreateInput = z.object({
  items: z.array(z.object({ saleItemId: id, quantity: quantity(100_000) })).min(1),
  refundMethod: z.enum(REFUND_METHODS).default("cash"),
  /** Put the returned items back in stock (false for damaged goods). */
  restock: z.boolean().default(true),
  reason: z.string().trim().max(300).optional(),
});
export type ReturnCreateInput = z.input<typeof returnCreateInput>;

/* -------------------------------- Customers ------------------------------- */

export const partyInput = z.object({
  name: z.string().trim().min(1).max(120),
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || z.email().safeParse(v).success, "invalid_email")
    .nullish(),
  address: optionalText(300),
  notes: optionalText(1000),
});

export const customerInput = partyInput.extend({
  creditLimit: money.nullish(),
});
export type CustomerInput = z.infer<typeof customerInput>;

export const supplierInput = partyInput;
export type SupplierInput = z.infer<typeof supplierInput>;

export const partyListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  /** Only parties with a non-zero balance. */
  withBalance: booleanQuery,
  ...pagination,
});
export type PartyListQuery = z.input<typeof partyListQuery>;

export const paymentInput = z.object({
  amount: positiveMoney,
  method: z.enum(PAYMENT_METHODS).default("cash"),
  note: z.string().trim().max(300).optional(),
});
export type PaymentInput = z.input<typeof paymentInput>;

/* -------------------------------- Purchases ------------------------------- */

export const purchaseCreateInput = z.object({
  supplierId: id.nullish(),
  reference: z.string().trim().max(60).optional(),
  items: z
    .array(
      z.object({
        productId: id,
        quantity: quantity(10_000_000),
        unitCost: money,
      }),
    )
    .min(1)
    .max(500),
  amountPaid: money.default(0),
  note: z.string().trim().max(500).optional(),
});
export type PurchaseCreateInput = z.input<typeof purchaseCreateInput>;

export const purchaseListQuery = z.object({
  supplierId: id.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  ...pagination,
});
export type PurchaseListQuery = z.input<typeof purchaseListQuery>;

/* --------------------------------- Shifts --------------------------------- */

export const shiftOpenInput = z.object({ openingCash: money.default(0) });
export const shiftCloseInput = z.object({
  countedCash: money,
  note: z.string().trim().max(500).optional(),
});
export const cashMovementInput = z.object({
  type: z.enum(["in", "out"]),
  amount: positiveMoney,
  reason: z.string().trim().min(1).max(200),
});
export type CashMovementInput = z.input<typeof cashMovementInput>;

export const shiftListQuery = z.object({ ...pagination });

/* --------------------------------- Reports -------------------------------- */

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
  /** Top products: one line per product family (default) or per variant. */
  groupVariants: booleanQuery,
});
export type ReportQuery = z.input<typeof reportQuery>;

/* ---------------------------- Settings & users ---------------------------- */

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);

export const storeSettingsInput = z.object({
  name: z.string().trim().min(1).max(120),
  address: optionalText(300),
  phone: optionalText(40),
  currency: currencySchema,
  receiptFooter: optionalText(300),
  requireShift: z.boolean().default(false),
  /** Warn when stock covers fewer days of sales than this. */
  stockAlertDays: z.number().int().min(1).max(90).default(7),
  /** Reorder suggestions cover this many days of sales. */
  reorderCoverDays: z.number().int().min(1).max(180).default(14),
  /** Label-scale barcodes (EAN-13 starting with 2): what the 5 digits hold. */
  scaleBarcodes: z.enum(SCALE_BARCODE_MODES).default("off"),
  shopType: z.enum(SHOP_TYPES).default("general"),
  /** VAT: prices include it; receipts and reports show it. */
  taxEnabled: z.boolean().default(false),
  taxRate: taxRate.default(19),
  taxId: optionalText(40),
});
export type StoreSettingsInput = z.infer<typeof storeSettingsInput>;

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_.]+$/, "invalid_username");

export const passwordSchema = z.string().min(6).max(128);

/** First-run setup (local mode) and sign-up (cloud mode). */
export const setupInput = z.object({
  storeName: z.string().trim().min(1).max(120),
  currency: currencySchema,
  name: z.string().trim().min(1).max(80),
  username: usernameSchema,
  password: passwordSchema,
  shopType: z.enum(SHOP_TYPES).default("general"),
  /** Language of the starter categories. */
  locale: z.enum(["en", "fr", "ar"]).default("fr"),
});
export type SetupInput = z.infer<typeof setupInput>;

export const ROLES = ["admin", "user"] as const;

export const userCreateInput = z.object({
  name: z.string().trim().min(1).max(80),
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(ROLES).default("user"),
});
export type UserCreateInput = z.input<typeof userCreateInput>;

export const userUpdateInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(ROLES).optional(),
  password: passwordSchema.optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateInput>;

/* --------------------------- Licensing & sync ----------------------------- */

export const licenseKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  // MIZN- keys; TAYS- keys were sold before the rename and stay valid.
  .regex(/^(MIZN|TAYS)(-[A-Z0-9]{4}){4}$/, "invalid_license_key");

export const licenseActivateInput = z.object({ key: licenseKeySchema });

export const syncLinkInput = z.object({
  cloudUrl: z.url().refine((u) => /^https?:\/\//.test(u), "invalid_url"),
  username: z.string().trim().min(1),
  password: z.string().min(1),
  deviceName: z.string().trim().min(1).max(60).default("Desktop"),
});
export type SyncLinkInput = z.input<typeof syncLinkInput>;

export const thresholdsInput = z.object({
  items: z
    .array(z.object({ productId: id, threshold: stockAmount(1_000_000) }))
    .min(1)
    .max(2000),
});
export type ThresholdsInput = z.infer<typeof thresholdsInput>;
