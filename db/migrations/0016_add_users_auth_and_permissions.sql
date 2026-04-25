-- Add local users, credentials, module permissions, and persisted app session.
-- Seeds one immutable system admin account with full permissions.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  is_system_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_system_admin IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_credentials (
  user_id TEXT PRIMARY KEY NOT NULL,
  password_hash TEXT,
  password_salt TEXT,
  pin_hash TEXT,
  pin_salt TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id TEXT NOT NULL,
  module_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, module_key),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_user_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (current_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_module ON user_permissions (module_key);
CREATE INDEX IF NOT EXISTS idx_users_active ON users (is_active);

INSERT OR IGNORE INTO users (
  id,
  username,
  full_name,
  role,
  is_system_admin,
  is_active,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'System Admin',
  'admin',
  1,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO user_credentials (
  user_id,
  password_hash,
  password_salt,
  pin_hash,
  pin_salt,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '2b665c0410fe3a25f0bf73fdf4c95668cb86c280ba9fffa560a15ff2a76c8278',
  'seed-admin-pass-v1',
  'abd467ec69ff9c67c901415023f84d94b255b51c95afbd6adcffc07f3875dc1f',
  'seed-admin-pin-v1',
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_session (id, current_user_id, updated_at)
VALUES (1, NULL, CURRENT_TIMESTAMP);
