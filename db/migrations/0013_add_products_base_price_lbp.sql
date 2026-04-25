-- Add product base cost price to separate it from selling price.
ALTER TABLE products ADD COLUMN base_price_lbp INTEGER NOT NULL DEFAULT 0 CHECK (base_price_lbp >= 0);
