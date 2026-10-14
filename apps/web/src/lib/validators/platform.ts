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
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Public website settings (landing page, sign-up trial), edited in the console. */
const price = z.number().int().min(0).max(100_000_000).nullable();
export const platformSettingsInput = z.object({
  /** Online subscription per month, in whole dinars; null = "price on request". */
  cloudMonthly: price,
  /** PC license, one payment, in whole dinars; null = "price on request". */
  licenseOneTime: price,
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
});
export type PlatformSettingsInput = z.input<typeof platformSettingsInput>;

export const auditListQuery = z.object({
  action: z.enum(AUDIT_ACTIONS).optional(),
  storeId: id.optional(),
  targetId: id.optional(),
  ...pagination,
});
export type AuditListQuery = z.input<typeof auditListQuery>;
