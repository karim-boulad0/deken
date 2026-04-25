-- Suppliers: what the shop owes suppliers (invoices minus payments). No stock linkage in v1.

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers (name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id TEXT PRIMARY KEY NOT NULL,
  supplier_id TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  amount_lbp INTEGER NOT NULL CHECK (amount_lbp > 0),
  reference TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier ON supplier_invoices (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_date ON supplier_invoices (invoice_date);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY NOT NULL,
  supplier_id TEXT NOT NULL,
  amount_lbp INTEGER NOT NULL CHECK (amount_lbp > 0),
  created_at TEXT NOT NULL,
  note TEXT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_created ON supplier_payments (created_at);
