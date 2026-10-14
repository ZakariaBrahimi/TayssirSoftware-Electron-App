INSERT INTO _sync_state (id, applying) VALUES (1, 0) ON CONFLICT(id) DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_stores_ins AFTER INSERT ON stores WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('stores', NEW.id, NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_stores_upd AFTER UPDATE ON stores WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('stores', NEW.id, NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_categories_ins AFTER INSERT ON categories WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('categories', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_categories_upd AFTER UPDATE ON categories WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('categories', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_brands_ins AFTER INSERT ON brands WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('brands', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_brands_upd AFTER UPDATE ON brands WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('brands', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_products_ins AFTER INSERT ON products WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('products', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_products_upd AFTER UPDATE ON products WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('products', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_customers_ins AFTER INSERT ON customers WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('customers', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_customers_upd AFTER UPDATE ON customers WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('customers', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_suppliers_ins AFTER INSERT ON suppliers WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('suppliers', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_suppliers_upd AFTER UPDATE ON suppliers WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('suppliers', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_shifts_ins AFTER INSERT ON shifts WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('shifts', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_shifts_upd AFTER UPDATE ON shifts WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('shifts', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_sales_ins AFTER INSERT ON sales WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('sales', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_sales_upd AFTER UPDATE ON sales WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('sales', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_sale_items_ins AFTER INSERT ON sale_items WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('sale_items', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_sale_items_upd AFTER UPDATE ON sale_items WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('sale_items', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_sale_returns_ins AFTER INSERT ON sale_returns WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('sale_returns', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_sale_returns_upd AFTER UPDATE ON sale_returns WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('sale_returns', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_return_items_ins AFTER INSERT ON return_items WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('return_items', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_return_items_upd AFTER UPDATE ON return_items WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('return_items', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_customer_payments_ins AFTER INSERT ON customer_payments WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('customer_payments', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_customer_payments_upd AFTER UPDATE ON customer_payments WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('customer_payments', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_purchases_ins AFTER INSERT ON purchases WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('purchases', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_purchases_upd AFTER UPDATE ON purchases WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('purchases', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_purchase_items_ins AFTER INSERT ON purchase_items WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('purchase_items', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_purchase_items_upd AFTER UPDATE ON purchase_items WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('purchase_items', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_supplier_payments_ins AFTER INSERT ON supplier_payments WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('supplier_payments', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_supplier_payments_upd AFTER UPDATE ON supplier_payments WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('supplier_payments', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_stock_movements_ins AFTER INSERT ON stock_movements WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('stock_movements', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_stock_movements_upd AFTER UPDATE ON stock_movements WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('stock_movements', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_cash_movements_ins AFTER INSERT ON cash_movements WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('cash_movements', NEW.id, NEW.store_id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS sync_cash_movements_upd AFTER UPDATE ON cash_movements WHEN (SELECT applying FROM _sync_state WHERE id = 1) = 0 AND NEW.updated_at IS NOT OLD.updated_at
BEGIN
  INSERT INTO _changes (tbl, row_id, store_id) VALUES ('cash_movements', NEW.id, NEW.store_id);
END;
