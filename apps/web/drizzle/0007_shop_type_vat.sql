ALTER TABLE `products` ADD `tax_rate` integer;--> statement-breakpoint
ALTER TABLE `return_items` ADD `tax_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_items` ADD `tax_rate` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_items` ADD `tax_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `tax_total` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stores` ADD `shop_type` text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `stores` ADD `tax_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `stores` ADD `tax_rate` integer DEFAULT 19 NOT NULL;--> statement-breakpoint
ALTER TABLE `stores` ADD `tax_id` text;