-- Track actor (admin/employee) for new transaction rows.
-- Legacy rows remain NULL by design.

ALTER TABLE sales
  ADD COLUMN created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE debt_payments
  ADD COLUMN created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE supplier_invoices
  ADD COLUMN created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE supplier_payments
  ADD COLUMN created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE expenses
  ADD COLUMN created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE customers
  ADD COLUMN created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_created_by_user ON sales (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_created_by_user ON debt_payments (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_created_by_user ON supplier_invoices (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_created_by_user ON supplier_payments (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by_user ON expenses (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_by_user ON customers (created_by_user_id);
