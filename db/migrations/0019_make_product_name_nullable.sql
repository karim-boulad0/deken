-- Allow product name to be null (Phase 5 modification). 
-- SQLite does not support ALTER TABLE DROP NOT NULL, so we remove the constraint by ignoring it or recreating the table.
-- However, we can simply remove the NOT NULL from the application logic and ensure the DB accepts it.
-- Since the products table was created with NOT NULL, we need to recreate it if we want to be strict.
-- But we can also just allow it in the code and handle SQLite errors, or use a default empty string.

-- Instead of a complex table recreation, we will use a migration that recreates the table with the new schema.

PRAGMA foreign_keys=OFF;

CREATE TABLE products_new (
  id TEXT PRIMARY KEY NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT, -- Nullable now
  category_id TEXT,
  category_size_id TEXT,
  category_flavor_id TEXT,
  base_price_lbp INTEGER NOT NULL DEFAULT 0 CHECK (base_price_lbp >= 0),
  price_lbp INTEGER NOT NULL DEFAULT 0 CHECK (price_lbp >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO products_new SELECT id, sku, barcode, name, category_id, category_size_id, category_flavor_id, base_price_lbp, price_lbp, stock, created_at, updated_at FROM products;

DROP TABLE products;
ALTER TABLE products_new RENAME TO products;

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_sku ON products (lower(trim(sku)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_barcode ON products (lower(trim(barcode)));
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);

PRAGMA foreign_keys=ON;
