import { randomUUID } from 'node:crypto'
import type { CreateProductInput, IpcErrorShape, IpcResult, ProductDto, UpdateProductInput } from '../../shared/ipc/types'
import { categoryExistsById } from './categoryService'
import type { Database } from 'better-sqlite3'

type JoinedRow = {
  id: string
  sku: string
  barcode: string | null
  name: string
  category_id: string | null
  price_lbp: number
  stock: number
  created_at: string
  updated_at: string
  c_id: string | null
  c_name: string | null
}

const SELECT_PRODUCT_DTO = `
  SELECT
    p.id, p.sku, p.barcode, p.name, p.category_id, p.price_lbp, p.stock, p.created_at, p.updated_at,
    c.id AS c_id, c.name AS c_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`

function joinedToDto(r: JoinedRow): ProductDto {
  return {
    id: r.id,
    sku: r.sku,
    barcode: r.barcode,
    name: r.name,
    category: r.c_id != null && r.c_name != null ? { id: r.c_id, name: r.c_name } : null,
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
    if (m === 'category_not_found') {
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

function validateCreate(input: CreateProductInput): IpcErrorShape | null {
  if (isBlank(input.sku)) {
    return makeError('validation', 'sku_required')
  }
  if (isBlank(input.name)) {
    return makeError('validation', 'name_required')
  }
  if (!Number.isInteger(input.priceLbp) || input.priceLbp < 0) {
    return makeError('validation', 'price_invalid')
  }
  if (!Number.isInteger(input.stock) || input.stock < 0) {
    return makeError('validation', 'stock_invalid')
  }
  return null
}

function validateUpdate(v: UpdateProductInput): IpcErrorShape | null {
  if (v.sku !== undefined && isBlank(v.sku)) {
    return makeError('validation', 'sku_required')
  }
  if (v.name !== undefined && isBlank(v.name)) {
    return makeError('validation', 'name_required')
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
         OR (c.id IS NOT NULL AND lower(trim(c.name)) LIKE '%' || @needle || '%'))
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
    assertCategoryIdValid(db, cid)
    const id = randomUUID()
    const barcode = input.barcode != null && norm(input.barcode) ? norm(input.barcode) : null
    const now = new Date().toISOString()
    const st = db.prepare(
      `INSERT INTO products (id, sku, barcode, name, category_id, price_lbp, stock, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    st.run(
      id,
      norm(input.sku),
      barcode,
      norm(input.name),
      cid,
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
    const priceLbp = input.priceLbp !== undefined ? input.priceLbp : existing.price_lbp
    const stock = input.stock !== undefined ? input.stock : existing.stock
    let categoryId: string | null
    if (input.categoryId === undefined) {
      categoryId = existing.category_id
    } else {
      const raw = input.categoryId
      categoryId = raw != null && !isBlank(String(raw)) ? String(raw) : null
    }
    assertCategoryIdValid(db, categoryId)
    const now = new Date().toISOString()
    const st = db.prepare(
      `UPDATE products
       SET sku = @sku, barcode = @barcode, name = @name, category_id = @categoryId,
           price_lbp = @priceLbp, stock = @stock, updated_at = @updatedAt
       WHERE id = @id`,
    )
    st.run({
      id,
      sku,
      name,
      barcode,
      categoryId,
      priceLbp,
      stock,
      updatedAt: now,
    })
    return getProductById(db, id)
  })
}

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
    return r ? joinedToDto(r) : null
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
