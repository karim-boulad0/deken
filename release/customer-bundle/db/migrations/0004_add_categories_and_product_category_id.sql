-- Normalized categories: managed in a dedicated UI section; products refer by id.
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_name_lower ON categories (lower(trim(name)));

-- Nullable: product may have no category.
ALTER TABLE products ADD COLUMN category_id TEXT;
