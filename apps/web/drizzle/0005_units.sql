ALTER TABLE `products` ADD `unit` text DEFAULT 'piece' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `scale_code` text;--> statement-breakpoint
ALTER TABLE `stores` ADD `scale_barcodes` text DEFAULT 'off' NOT NULL;