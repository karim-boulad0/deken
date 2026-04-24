-- Product catalog: MVP fields for inventory and POS (Phase 5). Money in LBP as integer.
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  category TEXT,
  price_lbp INTEGER NOT NULL DEFAULT 0 CHECK (price_lbp >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_sku ON products (lower(trim(sku)));

CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
