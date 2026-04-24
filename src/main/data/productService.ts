import { randomUUID } from 'node:crypto'
import type { CreateProductInput, IpcErrorShape, IpcResult, ProductDto, UpdateProductInput } from '../../shared/ipc/types'
import type { Database } from 'better-sqlite3'

type Row = {
  id: string
  sku: string
  barcode: string | null
  name: string
  price_lbp: number
  stock: number
  created_at: string
  updated_at: string
}

function rowToDto(r: Row): ProductDto {
  return {
    id: r.id,
    sku: r.sku,
    barcode: r.barcode,
    name: r.name,
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
    if (m.toLowerCase().includes('unique')) {
      return { ok: false, error: makeError('unique_violation', m) }
    }
    return { ok: false, error: makeError('internal_error', m) }
  }
}

const norm = (s: string) => s.trim()
const isBlank = (s: string) => s.trim().length === 0

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

export function listProducts(db: Database, searchQuery: string): IpcResult<ProductDto[]> {
  return asResult(() => {
    const q = norm(searchQuery)
    if (q === '') {
      const st = db.prepare('SELECT * FROM products ORDER BY name ASC')
      return (st.all() as Row[]).map(rowToDto)
    }
    const needle = q.toLowerCase()
    const st = db.prepare(
      `SELECT * FROM products
        WHERE
          lower(name) LIKE '%' || @needle || '%'
          OR lower(trim(sku)) LIKE '%' || @needle || '%'
          OR (barcode IS NOT NULL AND length(trim(barcode)) > 0
              AND lower(trim(barcode)) LIKE '%' || @needle || '%')
        ORDER BY name ASC`,
    )
    return (st.all({ needle }) as Row[]).map(rowToDto)
  })
}

export function createProduct(db: Database, input: CreateProductInput): IpcResult<ProductDto> {
  const v = validateCreate(input)
  if (v) {
    return { ok: false, error: v }
  }
  return asResult(() => {
    const id = randomUUID()
    const barcode = input.barcode != null && norm(input.barcode) ? norm(input.barcode) : null
    const now = new Date().toISOString()
    const st = db.prepare(
      `INSERT INTO products (id, sku, barcode, name, price_lbp, stock, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    st.run(
      id,
      norm(input.sku),
      barcode,
      norm(input.name),
      input.priceLbp,
      input.stock,
      now,
      now,
    )
    const r = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Row
    return rowToDto(r)
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
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Row | undefined
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
    const now = new Date().toISOString()
    const st = db.prepare(
      `UPDATE products
       SET sku = @sku, barcode = @barcode, name = @name,
           price_lbp = @priceLbp, stock = @stock, updated_at = @updatedAt
       WHERE id = @id`,
    )
    st.run({
      id,
      sku,
      name,
      barcode,
      priceLbp,
      stock,
      updatedAt: now,
    })
    const r = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Row
    return rowToDto(r)
  })
}

export function findProductByCode(db: Database, code: string): IpcResult<ProductDto | null> {
  if (isBlank(code)) {
    return { ok: true, data: null }
  }
  return asResult(() => {
    const c = norm(code).toLowerCase()
    const st = db.prepare(
      `SELECT * FROM products
        WHERE lower(trim(sku)) = @c
           OR (barcode IS NOT NULL AND length(trim(barcode)) > 0 AND lower(trim(barcode)) = @c)`,
    )
    const r = st.get({ c }) as Row | undefined
    return r ? rowToDto(r) : null
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
