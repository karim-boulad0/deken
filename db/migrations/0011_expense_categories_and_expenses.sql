-- Operating expenses (categories + lines). paid_from_cash reserved for cashflow alignment.

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_sort ON expense_categories (sort_order, name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL,
  amount_lbp INTEGER NOT NULL CHECK (amount_lbp > 0),
  spent_at TEXT NOT NULL,
  note TEXT,
  paid_from_cash INTEGER NOT NULL DEFAULT 1 CHECK (paid_from_cash IN (0, 1)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES expense_categories (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_expenses_spent_at ON expenses (spent_at);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_id);
