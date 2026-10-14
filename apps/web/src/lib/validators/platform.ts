import { z } from "zod";

/* Platform owner console (cloud mode). */

/** A store's subscription as it stands today (stored status + dates). */
export const STORE_STATUSES = [
  "trialing",
  "trial_expired",
  "active",
  "past_due",
  "expired",
  "canceled",
  "suspended",
] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled"] as const;
export const STORE_SORTS = ["-createdAt", "createdAt", "name", "-lastSeenAt", "renewalAt"] as const;
export const LICENSE_FILTERS = ["active", "expired", "revoked"] as const;
export const DEVICE_FILTERS = ["active", "stale", "revoked"] as const;
export const PLATFORM_PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "ccp",
  "card",
  "online",
  "other",
] as const;
export type PlatformPaymentMethod = (typeof PLATFORM_PAYMENT_METHODS)[number];

/* ------------------------------ Plan catalog ------------------------------ */

/**
 * Parts of the app a plan can include. Everything else (till, stock,
 * customers and credit, receipts, reports, exports) is in every plan.
 */
export const PLAN_FEATURES = ["suppliers", "shifts", "import"] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

/** How a request pays: a subscription period, or a one-time PC license. */
export const BILLING_PERIODS = ["month", "year", "lifetime"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const REQUEST_STATUSES = ["pending", "approved", "rejected", "canceled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
const search = z.string().trim().max(100).optional();
const id = z.string().min(1).max(64);
const plan = z.string().trim().min(1).max(40);
/** A calendar day; stored as the end of that day (UTC). */
const day = z.iso.date();
export const endOfDay = (d: string) => new Date(`${d}T23:59:59.999Z`);

export const platformStoreListQuery = z.object({
  q: search,
  status: z.enum(STORE_STATUSES).optional(),
  sort: z.enum(STORE_SORTS).default("-createdAt"),
  ...pagination,
});
export type PlatformStoreListQuery = z.input<typeof platformStoreListQuery>;

export const optionsQuery = z.object({ q: z.string().trim().max(100).default("") });

export const subscriptionInput = z.object({
  status: z.enum(SUBSCRIPTION_STATUSES),
  plan: plan.optional(),
  /** Last paid day; null = no end date. */
  currentPeriodEnd: day.nullable().optional(),
});
export type SubscriptionInput = z.input<typeof subscriptionInput>;

export const extendTrialInput = z.object({ days: z.number().int().min(1).max(365) });

export const reasonInput = z.object({ reason: z.string().trim().max(300).default("") });

export const passwordResetInput = z.object({ password: z.string().min(6).max(128) });

export const platformLicenseCreateInput = z.object({
  plan: plan.default("standard"),
  maxDevices: z.number().int().min(1).max(100).default(1),
  /** Validity in days; null = lifetime. */
  days: z.number().int().min(1).max(3650).nullable().default(365),
  customerName: z.string().trim().max(120).optional(),
});
export type PlatformLicenseCreateInput = z.input<typeof platformLicenseCreateInput>;

export const platformLicenseUpdateInput = z.object({
  plan: plan.optional(),
  maxDevices: z.number().int().min(1).max(100).optional(),
  customerName: z.string().trim().max(120).nullable().optional(),
  /** Last valid day; null = lifetime. */
  expiresAt: day.nullable().optional(),
});
export type PlatformLicenseUpdateInput = z.input<typeof platformLicenseUpdateInput>;

export const platformLicenseListQuery = z.object({
  q: search,
  status: z.enum(LICENSE_FILTERS).optional(),
  ...pagination,
});
export type PlatformLicenseListQuery = z.input<typeof platformLicenseListQuery>;

export const platformDeviceListQuery = z.object({
  q: search,
  status: z.enum(DEVICE_FILTERS).optional(),
  ...pagination,
});
export type PlatformDeviceListQuery = z.input<typeof platformDeviceListQuery>;

export const platformPaymentInput = z
  .object({
    storeId: id.optional(),
    licenseId: id.optional(),
    amount: z.number().int().min(1).max(1_000_000_000_000),
    method: z.enum(PLATFORM_PAYMENT_METHODS),
    reference: z.string().trim().max(120).optional(),
    plan: plan.optional(),
    /** Months of service paid (0 = one-off, e.g. a lifetime license). */
    months: z.number().int().min(0).max(60).default(1),
    note: z.string().trim().max(300).optional(),
  })
  .refine((v) => Boolean(v.storeId) !== Boolean(v.licenseId), {
    message: "store_or_license",
    path: ["storeId"],
  });
export type PlatformPaymentInput = z.input<typeof platformPaymentInput>;

export const platformPaymentListQuery = z.object({
  from: day.optional(),
  to: day.optional(),
  storeId: id.optional(),
  licenseId: id.optional(),
  method: z.enum(PLATFORM_PAYMENT_METHODS).optional(),
  ...pagination,
});
export type PlatformPaymentListQuery = z.input<typeof platformPaymentListQuery>;

export const AUDIT_ACTIONS = [
  "store.subscription",
  "store.trial_extend",
  "store.suspend",
  "store.reactivate",
  "store.user_password_reset",
  "license.create",
  "license.update",
  "license.revoke",
  "license.restore",
  "license.reset",
  "license.device_remove",
  "device.revoke",
  "payment.create",
  "payment.void",
  "platform.settings",
  "plan.create",
  "plan.update",
  "request.approve",
  "request.reject",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Public website settings (landing page, sign-up trial, payment details), edited in the console. */
export const platformSettingsInput = z.object({
  /** Free days for new online sign-ups. */
  trialDays: z.number().int().min(1).max(90),
  downloadUrl: z.url().refine((u) => u.startsWith("https://"), "https_only"),
  contactPhone: z.string().trim().max(40),
  /** International format, digits only (e.g. 213555123456); empty = hidden. */
  contactWhatsapp: z
    .string()
    .trim()
    .regex(/^(\d{8,15})?$/, "whatsapp_digits"),
  contactEmail: z.union([z.literal(""), z.email().max(120)]),
  /** Where shops send money (shown when they ask to pay). Empty = hidden. */
  payeeName: z.string().trim().max(80),
  ccpAccount: z.string().trim().max(40),
  ripAccount: z.string().trim().max(40),
  bankRib: z.string().trim().max(60),
  paymentNote: z.string().trim().max(300),
});
export type PlatformSettingsInput = z.input<typeof platformSettingsInput>;

const planPrice = z.number().int().min(0).max(100_000_000).nullable();
const limit = z.number().int().min(1).max(1000).nullable();
const label = (max: number) => z.string().trim().max(max);

export const planInput = z.object({
  /** Short id used in licenses and payments, e.g. "pro". Cannot change later. */
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9-]{1,23}$/, "plan_code"),
  nameEn: label(40).min(1),
  nameFr: label(40).min(1),
  nameAr: label(40).min(1),
  descEn: label(160).default(""),
  descFr: label(160).default(""),
  descAr: label(160).default(""),
  /** Whole dinars; null = not sold this way / price on request. */
  monthlyPrice: planPrice,
  yearlyPrice: planPrice,
  licensePrice: planPrice,
  /** null = unlimited. Devices = tills / PCs (linked desktops or license activations). */
  maxDevices: limit,
  maxUsers: limit,
  features: z.array(z.enum(PLAN_FEATURES)).max(PLAN_FEATURES.length),
  recommended: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});
export type PlanInput = z.input<typeof planInput>;
export const planUpdateInput = planInput.omit({ code: true });
export type PlanUpdateInput = z.input<typeof planUpdateInput>;

/** A shop asking to pay for a plan (approved by the platform owner). */
export const paymentRequestInput = z.object({
  planCode: z.string().trim().min(1).max(24),
  period: z.enum(BILLING_PERIODS),
  method: z.enum(PLATFORM_PAYMENT_METHODS),
  reference: z.string().trim().max(120).default(""),
  note: z.string().trim().max(300).default(""),
  /** Photo of the receipt, as a data URL (JPEG/PNG/WebP, about 1.5 MB at most). */
  receipt: z
    .string()
    .max(2_100_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "receipt_image")
    .nullable()
    .default(null),
  /** Who to call back (shown to the platform owner). */
  contactName: z.string().trim().max(80).default(""),
  contactPhone: z.string().trim().max(40).default(""),
  /** Desktops without a license or store: the shop's name. */
  shopName: z.string().trim().max(120).default(""),
});
export type PaymentRequestInput = z.input<typeof paymentRequestInput>;

export const requestListQuery = z.object({
  status: z.enum(REQUEST_STATUSES).optional(),
  ...pagination,
});
export type RequestListQuery = z.input<typeof requestListQuery>;

export const rejectInput = z.object({ reason: z.string().trim().min(1).max(300) });

export const auditListQuery = z.object({
  action: z.enum(AUDIT_ACTIONS).optional(),
  storeId: id.optional(),
  targetId: id.optional(),
  ...pagination,
});
export type AuditListQuery = z.input<typeof auditListQuery>;
