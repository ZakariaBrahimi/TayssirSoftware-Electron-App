CREATE TABLE `alert_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`kind` text NOT NULL,
	`address` text,
	`label` text,
	`link_code` text,
	`link_expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alert_channels_store_idx` ON `alert_channels` (`store_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `alert_channels_link_code_idx` ON `alert_channels` (`link_code`);--> statement-breakpoint
CREATE TABLE `alert_settings` (
	`store_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`digest_hour` integer DEFAULT 8 NOT NULL,
	`locale` text DEFAULT 'fr' NOT NULL,
	`last_sent_on` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `stores` ADD `stock_alert_days` integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `stores` ADD `reorder_cover_days` integer DEFAULT 14 NOT NULL;