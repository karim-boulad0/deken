-- No category management in the app; free-text column removed to match UI and API.
ALTER TABLE products DROP COLUMN category;
