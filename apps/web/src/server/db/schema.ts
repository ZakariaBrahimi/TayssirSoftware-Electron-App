import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
};

/* -------------------------------------------------------------------------- */
/*                         Better Auth (users & sessions)                     */
/* -------------------------------------------------------------------------- */

export const user = sqliteTable("user", {
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
  ...timestamps,
});

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
    ...timestamps,
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
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/*                                  Catalog                                   */
/* -------------------------------------------------------------------------- */

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  ...timestamps,
});

export const brands = sqliteTable("brands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  ...timestamps,
});

/**
 * All money amounts are stored as integers in the currency's minor unit
 * (e.g. centimes) to avoid floating point rounding errors.
 */
export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    barcode: text("barcode").notNull(),
    description: text("description"),
    costPrice: integer("cost_price").notNull().default(0),
    salePrice: integer("sale_price").notNull().default(0),
    stock: integer("stock").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    brandId: integer("brand_id").references(() => brands.id, {
      onDelete: "set null",
    }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("products_barcode_unique").on(t.barcode),
    index("products_name_idx").on(t.name),
    index("products_category_idx").on(t.categoryId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                   Sales                                    */
/* -------------------------------------------------------------------------- */

export const PAYMENT_METHODS = ["cash", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SALE_STATUSES = ["completed", "voided"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cashierId: text("cashier_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Sum of line totals (after line discounts) */
    subtotal: integer("subtotal").notNull(),
    /** Discount applied to the whole ticket */
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull(),
    /** Cost of goods sold, snapshotted at sale time for profit reports */
    totalCost: integer("total_cost").notNull(),
    paymentMethod: text("payment_method", { enum: PAYMENT_METHODS }).notNull().default("cash"),
    amountPaid: integer("amount_paid").notNull(),
    changeDue: integer("change_due").notNull().default(0),
    note: text("note"),
    status: text("status", { enum: SALE_STATUSES }).notNull().default("completed"),
    voidedAt: integer("voided_at", { mode: "timestamp" }),
    voidedById: text("voided_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [index("sales_created_at_idx").on(t.createdAt), index("sales_status_idx").on(t.status)],
);

export const saleItems = sqliteTable(
  "sale_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    // Snapshots so receipts and reports stay correct if the product changes
    productName: text("product_name").notNull(),
    barcode: text("barcode"),
    unitPrice: integer("unit_price").notNull(),
    unitCost: integer("unit_cost").notNull(),
    quantity: integer("quantity").notNull(),
    discount: integer("discount").notNull().default(0),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [
    index("sale_items_sale_idx").on(t.saleId),
    index("sale_items_product_idx").on(t.productId),
  ],
);

export const STOCK_MOVEMENT_REASONS = ["initial", "sale", "void", "adjustment"] as const;
export type StockMovementReason = (typeof STOCK_MOVEMENT_REASONS)[number];

/** Audit trail for every change to a product's stock level. */
export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    change: integer("change").notNull(),
    stockAfter: integer("stock_after").notNull(),
    reason: text("reason", { enum: STOCK_MOVEMENT_REASONS }).notNull(),
    saleId: integer("sale_id").references(() => sales.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("stock_movements_product_idx").on(t.productId)],
);

/* -------------------------------------------------------------------------- */
/*                                  Settings                                  */
/* -------------------------------------------------------------------------- */

/** Single-row table (id = 1) holding store-wide settings. */
export const storeSettings = sqliteTable("store_settings", {
  id: integer("id").primaryKey(),
  storeName: text("store_name").notNull().default("Tayssir Store"),
  address: text("address"),
  phone: text("phone"),
  currency: text("currency").notNull().default("DZD"),
  receiptFooter: text("receipt_footer"),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/*                                 Relations                                  */
/* -------------------------------------------------------------------------- */

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  saleItems: many(saleItems),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  cashier: one(user, { fields: [sales.cashierId], references: [user.id] }),
  items: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));
