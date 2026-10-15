CREATE TABLE `product_families` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`options` text DEFAULT '[]' NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_families_store_idx` ON `product_families` (`store_id`);--> statement-breakpoint
ALTER TABLE `products` ADD `family_id` text;--> statement-breakpoint
ALTER TABLE `products` ADD `variant_values` text;--> statement-breakpoint
CREATE INDEX `products_family_idx` ON `products` (`family_id`);--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_product_families_ins AFTER INSERT ON product_families WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('product_families', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_product_families_upd AFTER UPDATE ON product_families WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('product_families', NEW.id, NEW.store_id);
END;
