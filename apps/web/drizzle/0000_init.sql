CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brands_store_idx` ON `brands` (`store_id`);--> statement-breakpoint
CREATE TABLE `cash_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text,
	`user_id` text,
	`user_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cash_movements_shift_idx` ON `cash_movements` (`shift_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `categories_store_idx` ON `categories` (`store_id`);--> statement-breakpoint
CREATE TABLE `_changes` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tbl` text NOT NULL,
	`row_id` text NOT NULL,
	`store_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `_changes_store_seq_idx` ON `_changes` (`store_id`,`seq`);--> statement-breakpoint
CREATE TABLE `customer_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`shift_id` text,
	`amount` integer NOT NULL,
	`method` text DEFAULT 'cash' NOT NULL,
	`note` text,
	`cashier_id` text,
	`cashier_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_payments_customer_idx` ON `customer_payments` (`customer_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`notes` text,
	`credit_limit` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_store_idx` ON `customers` (`store_id`,`name`);--> statement-breakpoint
CREATE TABLE `license_activations` (
	`id` text PRIMARY KEY NOT NULL,
	`license_id` text NOT NULL,
	`device_id` text NOT NULL,
	`device_name` text,
	`last_seen_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `license_activations_license_idx` ON `license_activations` (`license_id`,`device_id`);--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`key_hint` text NOT NULL,
	`plan` text DEFAULT 'standard' NOT NULL,
	`customer_name` text,
	`max_devices` integer DEFAULT 1 NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `licenses_key_hash_unique` ON `licenses` (`key_hash`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`barcode` text NOT NULL,
	`description` text,
	`cost_price` integer DEFAULT 0 NOT NULL,
	`sale_price` integer DEFAULT 0 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`low_stock_threshold` integer DEFAULT 5 NOT NULL,
	`category_id` text,
	`brand_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_store_barcode_idx` ON `products` (`store_id`,`barcode`);--> statement-breakpoint
CREATE INDEX `products_store_name_idx` ON `products` (`store_id`,`name`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`purchase_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost` integer NOT NULL,
	`line_total` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `purchase_items_purchase_idx` ON `purchase_items` (`purchase_id`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`supplier_id` text,
	`supplier_name` text,
	`reference` text,
	`total` integer NOT NULL,
	`amount_paid` integer DEFAULT 0 NOT NULL,
	`note` text,
	`user_id` text,
	`user_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `purchases_store_created_idx` ON `purchases` (`store_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `purchases_supplier_idx` ON `purchases` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `return_items` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`return_id` text NOT NULL,
	`sale_item_id` text NOT NULL,
	`product_id` text,
	`product_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`refund_amount` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `return_items_return_idx` ON `return_items` (`return_id`);--> statement-breakpoint
CREATE INDEX `return_items_sale_item_idx` ON `return_items` (`sale_item_id`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`sale_id` text NOT NULL,
	`product_id` text,
	`product_name` text NOT NULL,
	`barcode` text,
	`unit_price` integer NOT NULL,
	`unit_cost` integer NOT NULL,
	`quantity` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`line_total` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `sale_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`sale_id` text NOT NULL,
	`shift_id` text,
	`refund_method` text DEFAULT 'cash' NOT NULL,
	`refund_amount` integer NOT NULL,
	`restocked_cost` integer DEFAULT 0 NOT NULL,
	`restock` integer DEFAULT true NOT NULL,
	`reason` text,
	`cashier_id` text,
	`cashier_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sale_returns_sale_idx` ON `sale_returns` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_returns_store_created_idx` ON `sale_returns` (`store_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`device_code` text NOT NULL,
	`seq` integer NOT NULL,
	`cashier_id` text,
	`cashier_name` text,
	`customer_id` text,
	`customer_name` text,
	`shift_id` text,
	`subtotal` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`total_cost` integer NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`amount_paid` integer NOT NULL,
	`change_due` integer DEFAULT 0 NOT NULL,
	`balance_due` integer DEFAULT 0 NOT NULL,
	`note` text,
	`status` text DEFAULT 'completed' NOT NULL,
	`voided_at` integer,
	`voided_by_id` text,
	`voided_by_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sales_store_created_idx` ON `sales` (`store_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `sales_customer_idx` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE INDEX `sales_shift_idx` ON `sales` (`shift_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`opened_by_id` text,
	`opened_by_name` text,
	`opening_cash` integer DEFAULT 0 NOT NULL,
	`closed_at` integer,
	`closed_by_id` text,
	`closed_by_name` text,
	`expected_cash` integer,
	`counted_cash` integer,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shifts_store_status_idx` ON `shifts` (`store_id`,`status`);--> statement-breakpoint
CREATE INDEX `shifts_opened_by_idx` ON `shifts` (`opened_by_id`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_id` text NOT NULL,
	`change` integer NOT NULL,
	`reason` text NOT NULL,
	`ref_id` text,
	`user_id` text,
	`user_name` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stock_movements_product_idx` ON `stock_movements` (`product_id`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`phone` text,
	`currency` text DEFAULT 'DZD' NOT NULL,
	`receipt_footer` text,
	`require_shift` integer DEFAULT false NOT NULL,
	`plan` text DEFAULT 'trial' NOT NULL,
	`subscription_status` text DEFAULT 'trialing' NOT NULL,
	`trial_ends_at` integer,
	`current_period_end` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `supplier_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text DEFAULT 'cash' NOT NULL,
	`note` text,
	`user_id` text,
	`user_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `supplier_payments_supplier_idx` ON `supplier_payments` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`notes` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `suppliers_store_idx` ON `suppliers` (`store_id`,`name`);--> statement-breakpoint
CREATE TABLE `sync_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`device_code` text NOT NULL,
	`token_hash` text NOT NULL,
	`last_seen_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_devices_token_hash_unique` ON `sync_devices` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sync_devices_store_idx` ON `sync_devices` (`store_id`);--> statement-breakpoint
CREATE TABLE `_sync_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`applying` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`username` text,
	`display_username` text,
	`role` text DEFAULT 'user' NOT NULL,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer,
	`store_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE INDEX `user_store_idx` ON `user` (`store_id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
