-- Allow voiding same-day cash sales (restock); excluded from reports/dashboard when set.

ALTER TABLE sales ADD COLUMN voided_at TEXT;
