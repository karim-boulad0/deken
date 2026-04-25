-- Customers; rebuild sales to allow type 'debt' and optional customer_id + note.

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name COLLATE NOCASE);

-- Drop dependent table first, then sales (rebuild to extend CHECK and columns).
CREATE TABLE _sale_lines_bak AS SELECT * FROM sale_lines;
DROP TABLE sale_lines;

CREATE TABLE _sales_bak AS SELECT * FROM sales;
DROP TABLE sales;

CREATE TABLE sales (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  total_lbp INTEGER NOT NULL CHECK (total_lbp >= 0),
  payment_type TEXT NOT NULL DEFAULT 'cash' CHECK (payment_type IN ('cash', 'debt')),
  customer_id TEXT,
  note TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
);

INSERT INTO sales (id, created_at, total_lbp, payment_type, customer_id, note)
SELECT id, created_at, total_lbp, 'cash', NULL, NULL
FROM _sales_bak;
DROP TABLE _sales_bak;

CREATE TABLE sale_lines (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_lbp INTEGER NOT NULL CHECK (unit_price_lbp >= 0),
  line_total_lbp INTEGER NOT NULL CHECK (line_total_lbp >= 0),
  FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE
);

INSERT INTO sale_lines SELECT * FROM _sale_lines_bak;
DROP TABLE _sale_lines_bak;

CREATE INDEX IF NOT EXISTS idx_sales_created ON sales (created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales (customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_lines_sale_id ON sale_lines (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_lines_product_id ON sale_lines (product_id);
