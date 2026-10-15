CREATE TABLE `payment_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text,
	`license_id` text,
	`device_id` text,
	`plan_code` text NOT NULL,
	`period` text NOT NULL,
	`months` integer NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`method` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`receipt` text,
	`contact_name` text DEFAULT '' NOT NULL,
	`contact_phone` text DEFAULT '' NOT NULL,
	`shop_name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_at` integer,
	`decided_by_name` text,
	`reject_reason` text,
	`payment_id` text,
	`delivery_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payment_requests_status_idx` ON `payment_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `payment_requests_store_idx` ON `payment_requests` (`store_id`);--> statement-breakpoint
CREATE INDEX `payment_requests_license_idx` ON `payment_requests` (`license_id`);--> statement-breakpoint
CREATE INDEX `payment_requests_device_idx` ON `payment_requests` (`device_id`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_en` text NOT NULL,
	`name_fr` text NOT NULL,
	`name_ar` text NOT NULL,
	`desc_en` text DEFAULT '' NOT NULL,
	`desc_fr` text DEFAULT '' NOT NULL,
	`desc_ar` text DEFAULT '' NOT NULL,
	`monthly_price` integer,
	`yearly_price` integer,
	`license_price` integer,
	`max_devices` integer,
	`max_users` integer,
	`features` text DEFAULT '[]' NOT NULL,
	`recommended` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_code_unique` ON `plans` (`code`);--> statement-breakpoint
ALTER TABLE `stores` ADD `scheduled_plan` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `plan_changes_at` integer;--> statement-breakpoint
INSERT INTO `plans` (`id`, `code`, `name_en`, `name_fr`, `name_ar`, `desc_en`, `desc_fr`, `desc_ar`, `max_devices`, `max_users`, `features`, `recommended`, `sort_order`, `active`, `created_at`, `updated_at`)
VALUES ('01a00000-0000-7000-8000-000000000001', 'essentiel', 'Essential', 'Essentiel', 'أساسي', 'One till for a small shop: sales, stock, customer credit and reports.', 'Une caisse pour un petit commerce : ventes, stock, crédit clients et rapports.', 'صندوق واحد لمتجر صغير: المبيعات والمخزون وديون الزبائن والتقارير.', 1, 2, '[]', 0, 10, 1, (unixepoch() * 1000), (unixepoch() * 1000))
ON CONFLICT(`code`) DO NOTHING;
--> statement-breakpoint
INSERT INTO `plans` (`id`, `code`, `name_en`, `name_fr`, `name_ar`, `desc_en`, `desc_fr`, `desc_ar`, `max_devices`, `max_users`, `features`, `recommended`, `sort_order`, `active`, `created_at`, `updated_at`)
VALUES ('01a00000-0000-7000-8000-000000000002', 'pro', 'Pro', 'Pro', 'احترافي', 'Several tills in sync, suppliers and deliveries, cash closing and Excel import.', 'Plusieurs caisses synchronisées, fournisseurs et livraisons, clôture de caisse et import Excel.', 'عدة صناديق متزامنة، الموردون والتوريدات، إغلاق الصندوق والاستيراد من Excel.', 3, NULL, '["suppliers","shifts","import"]', 1, 20, 1, (unixepoch() * 1000), (unixepoch() * 1000))
ON CONFLICT(`code`) DO NOTHING;
