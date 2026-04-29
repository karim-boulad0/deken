import { randomUUID } from 'node:crypto'
import type {
  BulkImportFlavorInput,
  BulkImportSizeInput,
  CategoryFlavorDto,
  CategorySizeDto,
  CreateCategoryFlavorInput,
  CreateCategorySizeInput,
  IpcErrorShape,
  IpcResult,
  UpdateCategoryFlavorInput,
  UpdateCategorySizeInput,
} from '../../shared/ipc/types'
import type { Database } from 'better-sqlite3'
import { categoryExistsById } from './categoryService'

type Row = {
  id: string
  category_id: string
  name: string
  created_at: string
  updated_at: string
}

function rowToSizeDto(r: Row): CategorySizeDto {
  return {
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function rowToFlavorDto(r: Row): CategoryFlavorDto {
  return {
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
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
    if (m === 'not_found') return { ok: false, error: makeError('not_found', m) }
    if (m === 'name_required' || m === 'category_required' || m === 'category_not_found') {
      return { ok: false, error: makeError('validation', m) }
    }
    if (m === 'size_in_use' || m === 'flavor_in_use') {
      return { ok: false, error: makeError('validation', m) }
    }
    if (m.toLowerCase().includes('unique')) {
      return { ok: false, error: makeError('unique_violation', 'name_taken') }
    }
    return { ok: false, error: makeError('internal_error', m) }
  }
}

const norm = (s: string) => s.trim()
const isBlank = (s: string) => s.trim().length === 0

function assertCategory(db: Database, categoryId: string): string {
  const cid = norm(categoryId)
  if (isBlank(cid)) throw new Error('category_required')
  if (!categoryExistsById(db, cid)) throw new Error('category_not_found')
  return cid
}

export function findOrCreateSizeByName(db: Database, categoryId: string, name: string): string {
  const normName = name.trim()
  const existing = db
    .prepare('SELECT id FROM product_sizes WHERE category_id = ? AND name = ? COLLATE NOCASE')
    .get(categoryId, normName) as { id: string } | undefined
  if (existing) return existing.id

  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO product_sizes (id, category_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, categoryId, normName, now, now)
  return id
}

export function findOrCreateFlavorByName(db: Database, categoryId: string, name: string): string {
  const normName = name.trim()
  const existing = db
    .prepare('SELECT id FROM product_flavors WHERE category_id = ? AND name = ? COLLATE NOCASE')
    .get(categoryId, normName) as { id: string } | undefined
  if (existing) return existing.id

  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO product_flavors (id, category_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, categoryId, normName, now, now)
  return id
}

export function listCategorySizes(db: Database): IpcResult<CategorySizeDto[]> {
  return asResult(() => {
    const rows = db
      .prepare('SELECT * FROM product_sizes ORDER BY lower(trim(name)) ASC')
      .all() as Row[]
    return rows.map(rowToSizeDto)
  })
}

export function createCategorySize(db: Database, input: CreateCategorySizeInput): IpcResult<CategorySizeDto> {
  if (isBlank(input.name)) return { ok: false, error: makeError('validation', 'name_required') }
  return asResult(() => {
    const categoryId = assertCategory(db, input.categoryId)
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare(
      'INSERT INTO product_sizes (id, category_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, categoryId, norm(input.name), now, now)
    const row = db.prepare('SELECT * FROM product_sizes WHERE id = ?').get(id) as Row
    return rowToSizeDto(row)
  })
}

export function updateCategorySize(
  db: Database,
  id: string,
  input: UpdateCategorySizeInput,
): IpcResult<CategorySizeDto> {
  if (isBlank(id)) return { ok: false, error: makeError('validation', 'id_required') }
  return asResult(() => {
    const existing = db.prepare('SELECT * FROM product_sizes WHERE id = ?').get(id) as Row | undefined
    if (!existing) throw new Error('not_found')
    const categoryId =
      input.categoryId !== undefined ? assertCategory(db, input.categoryId) : existing.category_id
    const name = input.name !== undefined ? norm(input.name) : existing.name
    if (isBlank(name)) throw new Error('name_required')
    const now = new Date().toISOString()
    db.prepare('UPDATE product_sizes SET category_id = ?, name = ?, updated_at = ? WHERE id = ?').run(
      categoryId,
      name,
      now,
      id,
    )
    const row = db.prepare('SELECT * FROM product_sizes WHERE id = ?').get(id) as Row
    return rowToSizeDto(row)
  })
}

export function deleteCategorySize(db: Database, id: string): IpcResult<null> {
  if (isBlank(id)) return { ok: false, error: makeError('validation', 'id_required') }
  return asResult(() => {
    const inUse = db
      .prepare('SELECT 1 as x FROM products WHERE category_size_id = ? LIMIT 1')
      .get(id) as { x: number } | undefined
    if (inUse) throw new Error('size_in_use')
    const n = db.prepare('DELETE FROM product_sizes WHERE id = ?').run(id)
    if (n.changes === 0) throw new Error('not_found')
    return null
  })
}

export function listCategoryFlavors(db: Database): IpcResult<CategoryFlavorDto[]> {
  return asResult(() => {
    const rows = db
      .prepare('SELECT * FROM product_flavors ORDER BY lower(trim(name)) ASC')
      .all() as Row[]
    return rows.map(rowToFlavorDto)
  })
}

export function createCategoryFlavor(
  db: Database,
  input: CreateCategoryFlavorInput,
): IpcResult<CategoryFlavorDto> {
  if (isBlank(input.name)) return { ok: false, error: makeError('validation', 'name_required') }
  return asResult(() => {
    const categoryId = assertCategory(db, input.categoryId)
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare(
      'INSERT INTO product_flavors (id, category_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, categoryId, norm(input.name), now, now)
    const row = db.prepare('SELECT * FROM product_flavors WHERE id = ?').get(id) as Row
    return rowToFlavorDto(row)
  })
}

export function updateCategoryFlavor(
  db: Database,
  id: string,
  input: UpdateCategoryFlavorInput,
): IpcResult<CategoryFlavorDto> {
  if (isBlank(id)) return { ok: false, error: makeError('validation', 'id_required') }
  return asResult(() => {
    const existing = db.prepare('SELECT * FROM product_flavors WHERE id = ?').get(id) as Row | undefined
    if (!existing) throw new Error('not_found')
    const categoryId =
      input.categoryId !== undefined ? assertCategory(db, input.categoryId) : existing.category_id
    const name = input.name !== undefined ? norm(input.name) : existing.name
    if (isBlank(name)) throw new Error('name_required')
    const now = new Date().toISOString()
    db.prepare('UPDATE product_flavors SET category_id = ?, name = ?, updated_at = ? WHERE id = ?').run(
      categoryId,
      name,
      now,
      id,
    )
    const row = db.prepare('SELECT * FROM product_flavors WHERE id = ?').get(id) as Row
    return rowToFlavorDto(row)
  })
}

export function deleteCategoryFlavor(db: Database, id: string): IpcResult<null> {
  if (isBlank(id)) return { ok: false, error: makeError('validation', 'id_required') }
  return asResult(() => {
    const inUse = db
      .prepare('SELECT 1 as x FROM products WHERE category_flavor_id = ? LIMIT 1')
      .get(id) as { x: number } | undefined
    if (inUse) throw new Error('flavor_in_use')
    const n = db.prepare('DELETE FROM product_flavors WHERE id = ?').run(id)
    if (n.changes === 0) throw new Error('not_found')
    return null
  })
}

export function categorySizeExistsById(db: Database, id: string): boolean {
  const row = db.prepare('SELECT category_id FROM product_sizes WHERE id = ?').get(id) as
    | { category_id: string }
    | undefined
  return Boolean(row)
}

export function categoryFlavorExistsById(db: Database, id: string): boolean {
  const row = db.prepare('SELECT category_id FROM product_flavors WHERE id = ?').get(id) as
    | { category_id: string }
    | undefined
  return Boolean(row)
}

export function getCategoryIdBySizeId(db: Database, id: string): string | null {
  const row = db.prepare('SELECT category_id FROM product_sizes WHERE id = ?').get(id) as
    | { category_id: string }
    | undefined
  return row?.category_id ?? null
}

export function getCategoryIdByFlavorId(db: Database, id: string): string | null {
  const row = db.prepare('SELECT category_id FROM product_flavors WHERE id = ?').get(id) as
    | { category_id: string }
    | undefined
  return row?.category_id ?? null
}

export function bulkImportSizes(
  db: Database,
  inputs: BulkImportSizeInput[],
): IpcResult<{ imported: number }> {
  return asResult(() => {
    let count = 0
    const transaction = db.transaction((rows: BulkImportSizeInput[]) => {
      for (const row of rows) {
        if (!row.name || !row.categoryId) continue
        findOrCreateSizeByName(db, row.categoryId, row.name)
        count++
      }
    })
    transaction(inputs)
    return { imported: count }
  })
}

export function bulkImportFlavors(
  db: Database,
  inputs: BulkImportFlavorInput[],
): IpcResult<{ imported: number }> {
  return asResult(() => {
    let count = 0
    const transaction = db.transaction((rows: BulkImportFlavorInput[]) => {
      for (const row of rows) {
        if (!row.name || !row.categoryId) continue
        findOrCreateFlavorByName(db, row.categoryId, row.name)
        count++
      }
    })
    transaction(inputs)
    return { imported: count }
  })
}
