-- Add optional image attachment to supplier invoices for scanned/phone snapshots.
ALTER TABLE supplier_invoices ADD COLUMN image_data_url TEXT;
