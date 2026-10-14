CREATE TABLE `platform_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`actor_name` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`store_id` text,
	`details` text,
	`ip` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `platform_audit_created_idx` ON `platform_audit` (`created_at`);--> statement-breakpoint
CREATE INDEX `platform_audit_store_idx` ON `platform_audit` (`store_id`);--> statement-breakpoint
CREATE TABLE `platform_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text,
	`license_id` text,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	`plan` text,
	`months` integer DEFAULT 0 NOT NULL,
	`period_start` integer,
	`period_end` integer,
	`note` text,
	`recorded_by_id` text,
	`recorded_by_name` text,
	`voided_at` integer,
	`voided_by_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `platform_payments_store_idx` ON `platform_payments` (`store_id`);--> statement-breakpoint
CREATE INDEX `platform_payments_license_idx` ON `platform_payments` (`license_id`);--> statement-breakpoint
CREATE INDEX `platform_payments_created_idx` ON `platform_payments` (`created_at`);--> statement-breakpoint
CREATE TABLE `store_activity` (
	`store_id` text PRIMARY KEY NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` text NOT NULL,
	`verified` integer DEFAULT true,
	`failed_verification_count` integer DEFAULT 0,
	`locked_until` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `two_factor_user_idx` ON `two_factor` (`user_id`);--> statement-breakpoint
CREATE INDEX `two_factor_secret_idx` ON `two_factor` (`secret`);--> statement-breakpoint
ALTER TABLE `license_activations` ADD `app_version` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `suspended_at` integer;--> statement-breakpoint
ALTER TABLE `stores` ADD `suspend_reason` text;--> statement-breakpoint
ALTER TABLE `sync_devices` ADD `app_version` text;--> statement-breakpoint
ALTER TABLE `user` ADD `two_factor_enabled` integer DEFAULT false;