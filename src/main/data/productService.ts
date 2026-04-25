import { randomUUID } from 'node:crypto'
import type { CreateProductInput, IpcErrorShape, IpcResult, ProductDto, UpdateProductInput } from '../../shared/ipc/types'
import { categoryExistsById } from './categoryService'
import { getCategoryIdByFlavorId, getCategoryIdBySizeId } from './productAttributeService'
import type { Database } from 'better-sqlite3'

type JoinedRow = {
  id: string
  sku: string
  barcode: string | null
  name: string
  category_id: string | null
  category_size_id: string | null
  category_flavor_id: string | null
  base_price_lbp: number
  price_lbp: number
  stock: number
  created_at: string
  updated_at: string
  c_id: string | null
  c_name: string | null
  s_id: string | null
  s_name: string | null
  f_id: string | null
  f_name: string | null
}

const SELECT_PRODUCT_DTO = `
  SELECT
    p.id, p.sku, p.barcode, p.name, p.category_id, p.category_size_id, p.category_flavor_id, p.base_price_lbp, p.price_lbp, p.stock, p.created_at, p.updated_at,
    c.id AS c_id, c.name AS c_name,
    s.id AS s_id, s.name AS s_name,
    f.id AS f_id, f.name AS f_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN product_sizes s ON s.id = p.category_size_id
  LEFT JOIN product_flavors f ON f.id = p.category_flavor_id
`

function joinedToDto(r: JoinedRow): ProductDto {
  return {
    id: r.id,
    sku: r.sku,
    barcode: r.barcode,
    name: r.name,
    category: r.c_id != null && r.c_name != null ? { id: r.c_id, name: r.c_name } : null,
    size: r.s_id != null && r.s_name != null ? { id: r.s_id, name: r.s_name } : null,
    flavor: r.f_id != null && r.f_name != null ? { id: r.f_id, name: r.f_name } : null,
    basePriceLbp: r.base_price_lbp,
    priceLbp: r.price_lbp,
    stock: r.stock,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function makeError(code: string, message: string, details?: string): IpcErrorShape {
  return { code, message, details }
}

function asResult<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    if (m === 'not_found') {
      return { ok: false, error: makeError('not_found', m) }
    }
    if (
      m === 'category_not_found' ||
      m === 'size_not_found' ||
      m === 'flavor_not_found' ||
      m === 'category_required_for_variant' ||
      m === 'size_category_mismatch' ||
      m === 'flavor_category_mismatch'
    ) {
      return { ok: false, error: makeError('validation', m) }
    }
    if (m.toLowerCase().includes('unique')) {
      return { ok: false, error: makeError('unique_violation', m) }
    }
    return { ok: false, error: makeError('internal_error', m) }
  }
}

const norm = (s: string) => s.trim()
const isBlank = (s: string) => s.trim().length === 0

function assertCategoryIdValid(db: Database, categoryId: string | null | undefined): void {
  if (categoryId == null || isBlank(categoryId)) {
    return
  }
  if (!categoryExistsById(db, categoryId)) {
    throw new Error('category_not_found')
  }
}

function assertSizeFlavorValid(
  db: Database,
  categoryId: string | null | undefined,
  sizeId: string | null | undefined,
  flavorId: string | null | undefined,
): void {
  const cat = categoryId != null && !isBlank(String(categoryId)) ? String(categoryId) : null
  const sz = sizeId != null && !isBlank(String(sizeId)) ? String(sizeId) : null
  const fl = flavorId != null && !isBlank(String(flavorId)) ? String(flavorId) : null
  if (cat == null && (sz != null || fl != null)) {
    throw new Error('category_required_for_variant')
  }
  if (sz != null) {
    const sizeCategoryId = getCategoryIdBySizeId(db, sz)
    if (sizeCategoryId == null) {
      throw new Error('size_not_found')
    }
    if (cat != null && sizeCategoryId !== cat) {
      throw new Error('size_category_mismatch')
    }
  }
  if (fl != null) {
    const flavorCategoryId = getCategoryIdByFlavorId(db, fl)
    if (flavorCategoryId == null) {
      throw new Error('flavor_not_found')
    }
    if (cat != null && flavorCategoryId !== cat) {
      throw new Error('flavor_category_mismatch')
    }
  }
}

function validateCreate(input: CreateProductInput): IpcErrorShape | null {
  if (isBlank(input.name)) {
    return makeError('validation', 'name_required')
  }
  if (!Number.isInteger(input.basePriceLbp) || input.basePriceLbp < 0) {
    return makeError('validation', 'base_price_invalid')
  }
  if (!Number.isInteger(input.priceLbp) || input.priceLbp < 0) {
    return makeError('validation', 'price_invalid')
  }
  if (!Number.isInteger(input.stock) || input.stock < 0) {
    return makeError('validation', 'stock_invalid')
  }
  return null
}

function generateAutoSku(db: Database): string {
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(CAST(substr(sku, 2) AS INTEGER)), 0) AS mx
       FROM products
       WHERE sku GLOB 'P[0-9]*'`,
    )
    .get() as { mx: number | null } | undefined
  const next = Math.max(1, Number(row?.mx ?? 0) + 1)
  return `P${String(next).padStart(6, '0')}`
}

function validateUpdate(v: UpdateProductInput): IpcErrorShape | null {
  if (v.sku !== undefined && isBlank(v.sku)) {
    return makeError('validation', 'sku_required')
  }
  if (v.name !== undefined && isBlank(v.name)) {
    return makeError('validation', 'name_required')
  }
  if (v.basePriceLbp !== undefined) {
    if (!Number.isInteger(v.basePriceLbp) || v.basePriceLbp < 0) {
      return makeError('validation', 'base_price_invalid')
    }
  }
  if (v.priceLbp !== undefined) {
    if (!Number.isInteger(v.priceLbp) || v.priceLbp < 0) {
      return makeError('validation', 'price_invalid')
    }
  }
  if (v.stock !== undefined) {
    if (!Number.isInteger(v.stock) || v.stock < 0) {
      return makeError('validation', 'stock_invalid')
    }
  }
  return null
}

export function listProducts(
  db: Database,
  searchQuery: string,
  filterCategoryId: string | null,
): IpcResult<ProductDto[]> {
  return asResult(() => {
    const q = norm(searchQuery)
    const fc = filterCategoryId != null && !isBlank(filterCategoryId) ? filterCategoryId : ''

    if (q === '') {
      if (fc === '') {
        const st = db.prepare(`${SELECT_PRODUCT_DTO} ORDER BY p.name ASC`)
        return (st.all() as JoinedRow[]).map(joinedToDto)
      }
      const st = db.prepare(
        `${SELECT_PRODUCT_DTO} WHERE p.category_id = @fc ORDER BY p.name ASC`,
      )
      return (st.all({ fc }) as JoinedRow[]).map(joinedToDto)
    }

    const needle = q.toLowerCase()
    const base = `${SELECT_PRODUCT_DTO}
      WHERE
        (lower(p.name) LIKE '%' || @needle || '%'
         OR lower(trim(p.sku)) LIKE '%' || @needle || '%'
         OR (p.barcode IS NOT NULL AND length(trim(p.barcode)) > 0
             AND lower(trim(p.barcode)) LIKE '%' || @needle || '%')
         OR (c.id IS NOT NULL AND lower(trim(c.name)) LIKE '%' || @needle || '%')
         OR (s.id IS NOT NULL AND lower(trim(s.name)) LIKE '%' || @needle || '%')
         OR (f.id IS NOT NULL AND lower(trim(f.name)) LIKE '%' || @needle || '%'))
    `
    if (fc === '') {
      const st = db.prepare(`${base} ORDER BY p.name ASC`)
      return (st.all({ needle }) as JoinedRow[]).map(joinedToDto)
    }
    const st = db.prepare(
      `${base} AND p.category_id = @fc
       ORDER BY p.name ASC`,
    )
    return (st.all({ needle, fc }) as JoinedRow[]).map(joinedToDto)
  })
}

function getProductById(db: Database, id: string): ProductDto {
  const r = db
    .prepare(`${SELECT_PRODUCT_DTO} WHERE p.id = ?`)
    .get(id) as JoinedRow | undefined
  if (!r) {
    throw new Error('not_found')
  }
  return joinedToDto(r)
}

export function createProduct(db: Database, input: CreateProductInput): IpcResult<ProductDto> {
  const v = validateCreate(input)
  if (v) {
    return { ok: false, error: v }
  }
  return asResult(() => {
    const cid =
      input.categoryId != null && !isBlank(String(input.categoryId)) ? String(input.categoryId) : null
    const categorySizeId =
      input.categorySizeId != null && !isBlank(String(input.categorySizeId))
        ? String(input.categorySizeId)
        : null
    const categoryFlavorId =
      input.categoryFlavorId != null && !isBlank(String(input.categoryFlavorId))
        ? String(input.categoryFlavorId)
        : null
    assertCategoryIdValid(db, cid)
    assertSizeFlavorValid(db, cid, categorySizeId, categoryFlavorId)
    const id = randomUUID()
    const barcode = input.barcode != null && norm(input.barcode) ? norm(input.barcode) : null
    const sku = isBlank(input.sku) ? generateAutoSku(db) : norm(input.sku)
    const now = new Date().toISOString()
    const st = db.prepare(
      `INSERT INTO products (id, sku, barcode, name, category_id, category_size_id, category_flavor_id, base_price_lbp, price_lbp, stock, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    st.run(
      id,
      sku,
      barcode,
      norm(input.name),
      cid,
      categorySizeId,
      categoryFlavorId,
      input.basePriceLbp,
      input.priceLbp,
      input.stock,
      now,
      now,
    )
    return getProductById(db, id)
  })
}

export function updateProduct(
  db: Database,
  id: string,
  input: UpdateProductInput,
): IpcResult<ProductDto> {
  const v = validateUpdate(input)
  if (v) {
    return { ok: false, error: v }
  }
  if (isBlank(id)) {
    return { ok: false, error: makeError('validation', 'id_required') }
  }
  return asResult(() => {
    const existing = db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(id) as
      | {
          id: string
          sku: string
          barcode: string | null
          name: string
          category_id: string | null
          category_size_id: string | null
          category_flavor_id: string | null
          base_price_lbp: number
          price_lbp: number
          stock: number
          created_at: string
          updated_at: string
        }
      | undefined
    if (!existing) {
      throw new Error('not_found')
    }
    const sku = input.sku !== undefined ? norm(input.sku) : existing.sku
    const name = input.name !== undefined ? norm(input.name) : existing.name
    let barcode: string | null
    if (input.barcode === null) {
      barcode = null
    } else if (input.barcode === undefined) {
      barcode = existing.barcode
    } else {
      const b = norm(input.barcode)
      barcode = b.length > 0 ? b : null
    }
    const basePriceLbp =
      input.basePriceLbp !== undefined ? input.basePriceLbp : existing.base_price_lbp
    const priceLbp = input.priceLbp !== undefined ? input.priceLbp : existing.price_lbp
    const stock = input.stock !== undefined ? input.stock : existing.stock
    let categoryId: string | null
    if (input.categoryId === undefined) {
      categoryId = existing.category_id
    } else {
      const raw = input.categoryId
      categoryId = raw != null && !isBlank(String(raw)) ? String(raw) : null
    }
    let categorySizeId: string | null
    if (input.categorySizeId === undefined) {
      categorySizeId = existing.category_size_id
    } else {
      const raw = input.categorySizeId
      categorySizeId = raw != null && !isBlank(String(raw)) ? String(raw) : null
    }
    let categoryFlavorId: string | null
    if (input.categoryFlavorId === undefined) {
      categoryFlavorId = existing.category_flavor_id
    } else {
      const raw = input.categoryFlavorId
      categoryFlavorId = raw != null && !isBlank(String(raw)) ? String(raw) : null
    }
    assertCategoryIdValid(db, categoryId)
    assertSizeFlavorValid(db, categoryId, categorySizeId, categoryFlavorId)
    const now = new Date().toISOString()
    const st = db.prepare(
      `UPDATE products
       SET sku = @sku, barcode = @barcode, name = @name, category_id = @categoryId,
           category_size_id = @categorySizeId, category_flavor_id = @categoryFlavorId,
           base_price_lbp = @basePriceLbp, price_lbp = @priceLbp, stock = @stock, updated_at = @updatedAt
       WHERE id = @id`,
    )
    st.run({
      id,
      sku,
      name,
      barcode,
      categoryId,
      categorySizeId,
      categoryFlavorId,
      basePriceLbp,
      priceLbp,
      stock,
      updatedAt: now,
    })
    return getProductById(db, id)
  })
}

/**
 * POS / scanner lookup: **full exact match** on **SKU or barcode** (after trim + case-fold).
 * No `LIKE` or partial — the full stored SKU or the full stored barcode.
 */
export function findProductByCode(db: Database, code: string): IpcResult<ProductDto | null> {
  if (isBlank(code)) {
    return { ok: true, data: null }
  }
  return asResult(() => {
    const c = norm(code).toLowerCase()
    const st = db.prepare(
      `${SELECT_PRODUCT_DTO}
        WHERE lower(trim(p.sku)) = @c
           OR (p.barcode IS NOT NULL AND length(trim(p.barcode)) > 0 AND lower(trim(p.barcode)) = @c)`,
    )
    const r = st.get({ c }) as JoinedRow | undefined
    if (!r) {
      return null
    }
    const skuKey = norm(r.sku).toLowerCase()
    const barKey =
      r.barcode != null && r.barcode.trim() !== '' ? norm(r.barcode).toLowerCase() : null
    if (skuKey !== c && (barKey == null || barKey !== c)) {
      return null
    }
    return joinedToDto(r)
  })
}

export function deleteProduct(db: Database, id: string): IpcResult<null> {
  if (isBlank(id)) {
    return { ok: false, error: makeError('validation', 'id_required') }
  }
  return asResult(() => {
    const n = db.prepare('DELETE FROM products WHERE id = ?').run(id)
    if (n.changes === 0) {
      throw new Error('not_found')
    }
    return null
  })
}
