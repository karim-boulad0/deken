-- Cash Box (Wallet) Management

CREATE TABLE IF NOT EXISTS wallet_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opening_balance_lbp INTEGER NOT NULL DEFAULT 0,
  actual_closing_balance_lbp INTEGER,
  expected_closing_balance_lbp INTEGER,
  created_by_user_id TEXT NOT NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_sessions_opened_at ON wallet_sessions (opened_at);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_closed_at ON wallet_sessions (closed_at);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  amount_lbp INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  reason TEXT,
  created_at TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES wallet_sessions (id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_session ON wallet_transactions (session_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions (created_at);
