-- Payments that reduce a customer's on-account balance (not a product sale).
CREATE TABLE IF NOT EXISTS debt_payments (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT NOT NULL,
  amount_lbp INTEGER NOT NULL CHECK (amount_lbp > 0),
  created_at TEXT NOT NULL,
  note TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_customer ON debt_payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_created ON debt_payments (created_at);
