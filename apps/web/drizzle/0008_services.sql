ALTER TABLE `products` ADD `kind` text DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `open_price` integer DEFAULT false NOT NULL;