-- Migration to clean up duplicates and enforce unique/required barcodes.
-- 1. Remove products with NULL or empty barcodes (since it's now required).
DELETE FROM products WHERE barcode IS NULL OR trim(barcode) = '';

-- 2. Remove duplicate barcodes, keeping only the most recent entry for each barcode.
DELETE FROM products 
WHERE id NOT IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER(PARTITION BY lower(trim(barcode)) ORDER BY created_at DESC, id DESC) as rn
        FROM products
        WHERE barcode IS NOT NULL AND trim(barcode) != ''
    ) WHERE rn = 1
);

-- 3. Create the unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_barcode ON products (lower(trim(barcode)));
