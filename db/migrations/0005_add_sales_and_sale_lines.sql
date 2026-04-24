-- Cash sales: header + lines with price snapshot. product_id is not a FK so history survives catalog edits/deletes.
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  total_lbp INTEGER NOT NULL CHECK (total_lbp >= 0),
  payment_type TEXT NOT NULL DEFAULT 'cash' CHECK (payment_type = 'cash')
);

CREATE TABLE IF NOT EXISTS sale_lines (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_lbp INTEGER NOT NULL CHECK (unit_price_lbp >= 0),
  line_total_lbp INTEGER NOT NULL CHECK (line_total_lbp >= 0),
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sales_created ON sales (created_at);
CREATE INDEX IF NOT EXISTS idx_sale_lines_sale_id ON sale_lines (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_lines_product_id ON sale_lines (product_id);
