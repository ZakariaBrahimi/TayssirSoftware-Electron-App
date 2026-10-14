/**
 * Database schema.
 *
 * Design rules (they make offline desktops and the multi-store cloud work
 * from the same schema, and let them sync with each other):
 *
 * - Every business row has a globally unique text id (UUIDv7) and a
 *   `storeId`, so rows created on different machines never collide.
 * - Rows are never hard-deleted; mutable entities are soft-deleted with
 *   `deletedAt`, so a deletion syncs like any other change.
 * - `updatedAt` (milliseconds) drives last-write-wins conflict resolution.
 * - Stock, customer and supplier balances are *derived* from append-only
 *   records (stock movements, sales, payments), so concurrent offline
 *   changes merge without losing anything. `products.stock` is a cache.
 * - Business tables declare no foreign keys or unique constraints: rows
 *   from another device may arrive in any order, and duplicates created
 *   offline must not block a sync. Integrity is enforced by the services.
 * - Money is stored as integers in the currency's minor unit.
 */
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { uuidv7 } from "@/lib/ids";
import { PLATFORM_PAYMENT_METHODS, SUBSCRIPTION_STATUSES } from "@/lib/validators/platform";

const ms = (name: string) => integer(name, { mode: "timestamp_ms" });

const timestamps = {
  createdAt: ms("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ms("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
};

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());

const storeId = () => text("store_id").notNull();

/** Who did it, snapshotted so the record stays meaningful on other devices. */
const textColumn = (name: string) => text(name);
function actor<P extends string>(prefix: P, column: string) {
  return {
    [`${prefix}Id`]: textColumn(`${column}_id`),
    [`${prefix}Name`]: textColumn(`${column}_name`),
  } as Record<`${P}Id` | `${P}Name`, ReturnType<typeof textColumn>>;
}

/* -------------------------------------------------------------------------- */
/*                         Better Auth (users & sessions)                     */
/*                 Not synced: each install has its own accounts.             */
/* -------------------------------------------------------------------------- */

const authTimestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
};

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    username: text("username").unique(),
    displayUsername: text("display_username"),
    role: text("role").notNull().default("user"),
    banned: integer("banned", { mode: "boolean" }).default(false),
    banReason: text("ban_reason"),
    banExpires: integer("ban_expires", { mode: "timestamp" }),
    storeId: text("store_id"),
    twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).default(false),
    ...authTimestamps,
  },
  (t) => [index("user_store_idx").on(t.storeId)],
);

/** Authenticator app (TOTP) secrets, managed by Better Auth's two-factor plugin. */
export const twoFactor = sqliteTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: integer("verified", { mode: "boolean" }).default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: integer("locked_until", { mode: "timestamp" }),
  },
  (t) => [index("two_factor_user_idx").on(t.userId), index("two_factor_secret_idx").on(t.secret)],
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    ...authTimestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    password: text("password"),
    ...authTimestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ...authTimestamps,
});

/* -------------------------------------------------------------------------- */
/*                                   Stores                                   */
/* -------------------------------------------------------------------------- */

export { SUBSCRIPTION_STATUSES };
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const stores = sqliteTable("stores", {
  id: id(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  currency: text("currency").notNull().default("DZD"),
  receiptFooter: text("receipt_footer"),
  /** When true, sales require an open cash register shift. */
  requireShift: integer("require_shift", { mode: "boolean" }).notNull().default(false),
  // Cloud subscription (managed by the platform, never accepted from a sync).
  plan: text("plan").notNull().default("trial"),
  subscriptionStatus: text("subscription_status", { enum: SUBSCRIPTION_STATUSES })
    .notNull()
    .default("trialing"),
  trialEndsAt: ms("trial_ends_at"),
  currentPeriodEnd: ms("current_period_end"),
  /** Set by the platform owner: the store becomes read-only. */
  suspendedAt: ms("suspended_at"),
  suspendReason: text("suspend_reason"),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/*                                  Catalog                                   */
/* -------------------------------------------------------------------------- */

export const categories = sqliteTable(
  "categories",
  {
    id: id(),
    storeId: storeId(),
    name: text("name").notNull(),
    deletedAt: ms("deleted_at"),
    ...timestamps,
  },
  (t) => [index("categories_store_idx").on(t.storeId)],
);

export const brands = sqliteTable(
  "brands",
  {
    id: id(),
    storeId: storeId(),
    name: text("name").notNull(),
    deletedAt: ms("deleted_at"),
    ...timestamps,
  },
  (t) => [index("brands_store_idx").on(t.storeId)],
);

export const products = sqliteTable(
  "products",
  {
    id: id(),
    storeId: storeId(),
    name: text("name").notNull(),
    barcode: text("barcode").notNull(),
    description: text("description"),
    costPrice: integer("cost_price").notNull().default(0),
    salePrice: integer("sale_price").notNull().default(0),
    /** Cache of SUM(stock_movements.change); recomputed after a sync. */
    stock: integer("stock").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    categoryId: text("category_id"),
    brandId: text("brand_id"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    deletedAt: ms("deleted_at"),
    ...timestamps,
  },
  (t) => [
    index("products_store_barcode_idx").on(t.storeId, t.barcode),
    index("products_store_name_idx").on(t.storeId, t.name),
    index("products_category_idx").on(t.categoryId),
  ],
);

export const STOCK_MOVEMENT_REASONS = [
  "initial",
  "sale",
  "void",
  "return",
  "purchase",
  "adjustment",
] as const;
export type StockMovementReason = (typeof STOCK_MOVEMENT_REASONS)[number];

/** Append-only ledger of every stock change. Stock = SUM(change). */
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: id(),
    storeId: storeId(),
    productId: text("product_id").notNull(),
    change: integer("change").notNull(),
    reason: text("reason", { enum: STOCK_MOVEMENT_REASONS }).notNull(),
    /** The sale, return or purchase that caused the movement. */
    refId: text("ref_id"),
    ...actor("user", "user"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [index("stock_movements_product_idx").on(t.productId)],
);

/* -------------------------------------------------------------------------- */
/*                                  Parties                                   */
/* -------------------------------------------------------------------------- */

export const customers = sqliteTable(
  "customers",
  {
    id: id(),
    storeId: storeId(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    /** Maximum amount the customer may owe. NULL = no limit. */
    creditLimit: integer("credit_limit"),
    deletedAt: ms("deleted_at"),
    ...timestamps,
  },
  (t) => [index("customers_store_idx").on(t.storeId, t.name)],
);

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: id(),
    storeId: storeId(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    deletedAt: ms("deleted_at"),
    ...timestamps,
  },
  (t) => [index("suppliers_store_idx").on(t.storeId, t.name)],
);

export const PAYMENT_METHODS = ["cash", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Payment methods of a sale: "credit" means the customer pays later. */
export const SALE_PAYMENT_METHODS = [...PAYMENT_METHODS, "credit"] as const;
export type SalePaymentMethod = (typeof SALE_PAYMENT_METHODS)[number];

export const customerPayments = sqliteTable(
  "customer_payments",
  {
    id: id(),
    storeId: storeId(),
    customerId: text("customer_id").notNull(),
    shiftId: text("shift_id"),
    amount: integer("amount").notNull(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull().default("cash"),
    note: text("note"),
    ...actor("cashier", "cashier"),
    ...timestamps,
  },
  (t) => [index("customer_payments_customer_idx").on(t.customerId)],
);

export const supplierPayments = sqliteTable(
  "supplier_payments",
  {
    id: id(),
    storeId: storeId(),
    supplierId: text("supplier_id").notNull(),
    amount: integer("amount").notNull(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull().default("cash"),
    note: text("note"),
    ...actor("user", "user"),
    ...timestamps,
  },
  (t) => [index("supplier_payments_supplier_idx").on(t.supplierId)],
);

/* -------------------------------------------------------------------------- */
/*                                   Sales                                    */
/* -------------------------------------------------------------------------- */

export const SALE_STATUSES = ["completed", "voided"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const sales = sqliteTable(
  "sales",
  {
    id: id(),
    storeId: storeId(),
    /** Receipt number = `${deviceCode}-${seq}` (unique per device). */
    deviceCode: text("device_code").notNull(),
    seq: integer("seq").notNull(),
    ...actor("cashier", "cashier"),
    customerId: text("customer_id"),
    customerName: text("customer_name"),
    shiftId: text("shift_id"),
    /** Sum of line totals (after line discounts). */
    subtotal: integer("subtotal").notNull(),
    /** Discount applied to the whole ticket. */
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull(),
    /** Cost of goods sold, snapshotted at sale time. */
    totalCost: integer("total_cost").notNull(),
    paymentMethod: text("payment_method", { enum: SALE_PAYMENT_METHODS }).notNull().default("cash"),
    /** Amount handed over by the customer. */
    amountPaid: integer("amount_paid").notNull(),
    changeDue: integer("change_due").notNull().default(0),
    /** Part of the total the customer still owes (credit sales). */
    balanceDue: integer("balance_due").notNull().default(0),
    note: text("note"),
    status: text("status", { enum: SALE_STATUSES }).notNull().default("completed"),
    voidedAt: ms("voided_at"),
    ...actor("voidedBy", "voided_by"),
    ...timestamps,
  },
  (t) => [
    index("sales_store_created_idx").on(t.storeId, t.createdAt),
    index("sales_customer_idx").on(t.customerId),
    index("sales_shift_idx").on(t.shiftId),
  ],
);

export const saleItems = sqliteTable(
  "sale_items",
  {
    id: id(),
    storeId: storeId(),
    saleId: text("sale_id").notNull(),
    productId: text("product_id"),
    // Snapshots so receipts and reports stay correct if the product changes.
    productName: text("product_name").notNull(),
    barcode: text("barcode"),
    unitPrice: integer("unit_price").notNull(),
    unitCost: integer("unit_cost").notNull(),
    quantity: integer("quantity").notNull(),
    discount: integer("discount").notNull().default(0),
    lineTotal: integer("line_total").notNull(),
    ...timestamps,
  },
  (t) => [
    index("sale_items_sale_idx").on(t.saleId),
    index("sale_items_product_idx").on(t.productId),
  ],
);

export const REFUND_METHODS = [...PAYMENT_METHODS, "account"] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];

export const saleReturns = sqliteTable(
  "sale_returns",
  {
    id: id(),
    storeId: storeId(),
    saleId: text("sale_id").notNull(),
    shiftId: text("shift_id"),
    /** "account" credits the customer's balance instead of paying out. */
    refundMethod: text("refund_method", { enum: REFUND_METHODS }).notNull().default("cash"),
    refundAmount: integer("refund_amount").notNull(),
    /** Cost of the items put back in stock (reduces cost of goods sold). */
    restockedCost: integer("restocked_cost").notNull().default(0),
    restock: integer("restock", { mode: "boolean" }).notNull().default(true),
    reason: text("reason"),
    ...actor("cashier", "cashier"),
    ...timestamps,
  },
  (t) => [
    index("sale_returns_sale_idx").on(t.saleId),
    index("sale_returns_store_created_idx").on(t.storeId, t.createdAt),
  ],
);

export const returnItems = sqliteTable(
  "return_items",
  {
    id: id(),
    storeId: storeId(),
    returnId: text("return_id").notNull(),
    saleItemId: text("sale_item_id").notNull(),
    productId: text("product_id"),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    refundAmount: integer("refund_amount").notNull(),
    ...timestamps,
  },
  (t) => [
    index("return_items_return_idx").on(t.returnId),
    index("return_items_sale_item_idx").on(t.saleItemId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                 Purchasing                                 */
/* -------------------------------------------------------------------------- */

export const purchases = sqliteTable(
  "purchases",
  {
    id: id(),
    storeId: storeId(),
    supplierId: text("supplier_id"),
    supplierName: text("supplier_name"),
    /** Supplier's invoice / delivery note number. */
    reference: text("reference"),
    total: integer("total").notNull(),
    /** Paid when the goods were received; the rest is owed to the supplier. */
    amountPaid: integer("amount_paid").notNull().default(0),
    note: text("note"),
    ...actor("user", "user"),
    ...timestamps,
  },
  (t) => [
    index("purchases_store_created_idx").on(t.storeId, t.createdAt),
    index("purchases_supplier_idx").on(t.supplierId),
  ],
);

export const purchaseItems = sqliteTable(
  "purchase_items",
  {
    id: id(),
    storeId: storeId(),
    purchaseId: text("purchase_id").notNull(),
    productId: text("product_id").notNull(),
    productName: text("product_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: integer("unit_cost").notNull(),
    lineTotal: integer("line_total").notNull(),
    ...timestamps,
  },
  (t) => [index("purchase_items_purchase_idx").on(t.purchaseId)],
);

/* -------------------------------------------------------------------------- */
/*                          Cash register (shifts)                            */
/* -------------------------------------------------------------------------- */

export const SHIFT_STATUSES = ["open", "closed"] as const;

export const shifts = sqliteTable(
  "shifts",
  {
    id: id(),
    storeId: storeId(),
    status: text("status", { enum: SHIFT_STATUSES }).notNull().default("open"),
    ...actor("openedBy", "opened_by"),
    openingCash: integer("opening_cash").notNull().default(0),
    closedAt: ms("closed_at"),
    ...actor("closedBy", "closed_by"),
    /** Computed when the shift is closed. */
    expectedCash: integer("expected_cash"),
    countedCash: integer("counted_cash"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("shifts_store_status_idx").on(t.storeId, t.status),
    index("shifts_opened_by_idx").on(t.openedById),
  ],
);

export const CASH_MOVEMENT_TYPES = ["in", "out"] as const;

/** Money put into or taken out of the drawer during a shift (expenses…). */
export const cashMovements = sqliteTable(
  "cash_movements",
  {
    id: id(),
    storeId: storeId(),
    shiftId: text("shift_id").notNull(),
    type: text("type", { enum: CASH_MOVEMENT_TYPES }).notNull(),
    amount: integer("amount").notNull(),
    reason: text("reason"),
    ...actor("user", "user"),
    ...timestamps,
  },
  (t) => [index("cash_movements_shift_idx").on(t.shiftId)],
);

/* -------------------------------------------------------------------------- */
/*                          Local install metadata                            */
/* -------------------------------------------------------------------------- */

/** Key/value settings of this installation (never synced). */
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/* -------------------------------------------------------------------------- */
/*                         Cloud: licensing & sync                            */
/* -------------------------------------------------------------------------- */

export const licenses = sqliteTable("licenses", {
  id: id(),
  /** SHA-256 of the license key; the key itself is never stored. */
  keyHash: text("key_hash").notNull().unique(),
  /** Last characters of the key, to help support find it. */
  keyHint: text("key_hint").notNull(),
  plan: text("plan").notNull().default("standard"),
  customerName: text("customer_name"),
  maxDevices: integer("max_devices").notNull().default(1),
  /** NULL = lifetime license. */
  expiresAt: ms("expires_at"),
  revokedAt: ms("revoked_at"),
  ...timestamps,
});

export const licenseActivations = sqliteTable(
  "license_activations",
  {
    id: id(),
    licenseId: text("license_id").notNull(),
    deviceId: text("device_id").notNull(),
    deviceName: text("device_name"),
    appVersion: text("app_version"),
    lastSeenAt: ms("last_seen_at"),
    ...timestamps,
  },
  (t) => [index("license_activations_license_idx").on(t.licenseId, t.deviceId)],
);

/** Desktop installs linked to a cloud store. */
export const syncDevices = sqliteTable(
  "sync_devices",
  {
    id: id(),
    storeId: storeId(),
    name: text("name").notNull(),
    /** Short code used in receipt numbers. */
    deviceCode: text("device_code").notNull(),
    /** SHA-256 of the device token. */
    tokenHash: text("token_hash").notNull().unique(),
    appVersion: text("app_version"),
    lastSeenAt: ms("last_seen_at"),
    revokedAt: ms("revoked_at"),
    ...timestamps,
  },
  (t) => [index("sync_devices_store_idx").on(t.storeId)],
);

/* -------------------------------------------------------------------------- */
/*                    Cloud: platform owner console (not synced)              */
/* -------------------------------------------------------------------------- */

/** Last time anyone used a store (web session or synced device). */
export const storeActivity = sqliteTable("store_activity", {
  storeId: text("store_id").primaryKey(),
  lastSeenAt: ms("last_seen_at").notNull(),
});

/** Payments received by the platform owner (subscriptions and licenses). */
export const platformPayments = sqliteTable(
  "platform_payments",
  {
    id: id(),
    /** Exactly one of storeId / licenseId is set. */
    storeId: text("store_id"),
    licenseId: text("license_id"),
    /** In the platform currency's minor unit. */
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    method: text("method", { enum: PLATFORM_PAYMENT_METHODS }).notNull(),
    reference: text("reference"),
    plan: text("plan"),
    /** Months of service paid for (0 for a one-off license sale). */
    months: integer("months").notNull().default(0),
    periodStart: ms("period_start"),
    periodEnd: ms("period_end"),
    note: text("note"),
    ...actor("recordedBy", "recorded_by"),
    voidedAt: ms("voided_at"),
    voidedByName: text("voided_by_name"),
    ...timestamps,
  },
  (t) => [
    index("platform_payments_store_idx").on(t.storeId),
    index("platform_payments_license_idx").on(t.licenseId),
    index("platform_payments_created_idx").on(t.createdAt),
  ],
);

/** Every action taken in the platform console or the vendor CLI. */
export const platformAudit = sqliteTable(
  "platform_audit",
  {
    id: id(),
    ...actor("actor", "actor"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    /** Store concerned, to show a store's history. */
    storeId: text("store_id"),
    /** JSON with the action's details. */
    details: text("details"),
    ip: text("ip"),
    createdAt: ms("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("platform_audit_created_idx").on(t.createdAt),
    index("platform_audit_store_idx").on(t.storeId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                             Sync bookkeeping                               */
/* -------------------------------------------------------------------------- */

/**
 * Tables replicated between a desktop install and its cloud store.
 * Order matters: parents before children when applying a batch.
 */
export const SYNC_TABLES = {
  stores,
  categories,
  brands,
  products,
  customers,
  suppliers,
  shifts,
  sales,
  sale_items: saleItems,
  sale_returns: saleReturns,
  return_items: returnItems,
  customer_payments: customerPayments,
  purchases,
  purchase_items: purchaseItems,
  supplier_payments: supplierPayments,
  stock_movements: stockMovements,
  cash_movements: cashMovements,
} as const;

export type SyncTableName = keyof typeof SYNC_TABLES;

/**
 * Change log filled by SQLite triggers (see the sync_triggers migration):
 * every insert/update of a synced row appends (table, row id). A device
 * pushes its log to the cloud, and pulls the cloud's log, by sequence.
 */
export const changes = sqliteTable(
  "_changes",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    tbl: text("tbl").notNull(),
    rowId: text("row_id").notNull(),
    storeId: text("store_id").notNull(),
  },
  (t) => [index("_changes_store_seq_idx").on(t.storeId, t.seq)],
);

/** Single row; `applying = 1` while remote changes are applied (no echo). */
export const syncState = sqliteTable("_sync_state", {
  id: integer("id").primaryKey(),
  applying: integer("applying").notNull().default(0),
});
