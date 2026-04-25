-- Key/value preferences (shop display name, LBP/USD for approximations, etc.).

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES ('lbp_per_usd', '89500');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('shop_name', '');
