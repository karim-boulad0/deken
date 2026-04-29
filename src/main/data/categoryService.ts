import { randomUUID } from 'crypto'
import type {
  BulkImportCategoryInput,
  CategoryDto,
  CreateCategoryInput,
  IpcErrorShape,
  IpcResult,
  UpdateCategoryInput,
} from '../../shared/ipc/types'
import type { Database } from 'better-sqlite3'

type Row = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

function rowToDto(r: Row): CategoryDto {
  return {
    id: r.id,
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
    if (m === 'not_found') {
      return { ok: false, error: makeError('not_found', m) }
    }
    if (m === 'category_in_use') {
      return { ok: false, error: makeError('validation', m) }
    }
    if (m === 'name_required') {
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

export function listCategories(db: Database): IpcResult<CategoryDto[]> {
  return asResult(() => {
    const rows = db.prepare('SELECT * FROM categories ORDER BY lower(trim(name)) ASC').all() as Row[]
    return rows.map(rowToDto)
  })
}

export function createCategory(db: Database, input: CreateCategoryInput): IpcResult<CategoryDto> {
  if (isBlank(input.name)) return { ok: false, error: makeError('validation', 'name_required') }
  return asResult(() => {
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare('INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
      id,
      norm(input.name),
      now,
      now,
    )
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Row
    return rowToDto(row)
  })
}

export function updateCategory(
  db: Database,
  id: string,
  input: UpdateCategoryInput,
): IpcResult<CategoryDto> {
  if (isBlank(id)) return { ok: false, error: makeError('validation', 'id_required') }
  return asResult(() => {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Row | undefined
    if (!existing) throw new Error('not_found')
    const name = input.name !== undefined ? norm(input.name) : existing.name
    if (isBlank(name)) throw new Error('name_required')
    const now = new Date().toISOString()
    db.prepare('UPDATE categories SET name = ?, updated_at = ? WHERE id = ?').run(name, now, id)
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Row
    return rowToDto(row)
  })
}

export function deleteCategory(db: Database, id: string): IpcResult<null> {
  if (isBlank(id)) {
    return { ok: false, error: makeError('validation', 'id_required') }
  }
  return asResult(() => {
    const n = db
      .prepare('SELECT 1 as x FROM products WHERE category_id = ? LIMIT 1')
      .get(id) as { x: number } | undefined
    if (n) {
      throw new Error('category_in_use')
    }
    const hasSizes = db
      .prepare('SELECT 1 as x FROM product_sizes WHERE category_id = ? LIMIT 1')
      .get(id) as { x: number } | undefined
    if (hasSizes) {
      throw new Error('category_in_use')
    }
    const hasFlavors = db
      .prepare('SELECT 1 as x FROM product_flavors WHERE category_id = ? LIMIT 1')
      .get(id) as { x: number } | undefined
    if (hasFlavors) {
      throw new Error('category_in_use')
    }
    const del = db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    if (del.changes === 0) {
      throw new Error('not_found')
    }
    return null
  })
}

export function categoryExistsById(db: Database, id: string): boolean {
  const r = db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id)
  return !!r
}

export function bulkImportCategories(
  db: Database,
  inputs: BulkImportCategoryInput[],
): IpcResult<{ imported: number }> {
  return asResult(() => {
    let count = 0
    const transaction = db.transaction((rows: BulkImportCategoryInput[]) => {
      for (const row of rows) {
        if (!row.name) continue
        const existing = db
          .prepare('SELECT 1 FROM categories WHERE lower(name) = ?')
          .get(row.name.toLowerCase())
        if (existing) continue

        const id = randomUUID()
        const now = new Date().toISOString()
        db.prepare('INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
          id,
          row.name.trim(),
          now,
          now,
        )
        count++
      }
    })
    transaction(inputs)
    return { imported: count }
  })
}
