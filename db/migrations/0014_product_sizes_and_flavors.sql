-- Add category-linked product sizes and flavors, and link them to products.
CREATE TABLE IF NOT EXISTS product_sizes (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_sizes_cat_name
  ON product_sizes (category_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_product_sizes_category_id
  ON product_sizes (category_id);

CREATE TABLE IF NOT EXISTS product_flavors (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_flavors_cat_name
  ON product_flavors (category_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_product_flavors_category_id
  ON product_flavors (category_id);

ALTER TABLE products ADD COLUMN category_size_id TEXT;
ALTER TABLE products ADD COLUMN category_flavor_id TEXT;
