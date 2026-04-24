import type { ProductDto } from '../../../../shared/ipc/types'

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Whether `raw` exactly matches the product's **SKU** or **barcode** (case-insensitive, trim).
 */
export function productMatchesLookupCode(raw: string, p: ProductDto): boolean {
  const key = norm(raw)
  if (key.length === 0) {
    return false
  }
  if (norm(p.sku) === key) {
    return true
  }
  return p.barcode != null && p.barcode.trim() !== '' && norm(p.barcode) === key
}
