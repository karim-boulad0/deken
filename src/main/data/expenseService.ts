import { randomUUID } from 'node:crypto'
import type {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  ExpenseCategoryDto,
  ExpenseDto,
  ExpenseTotalInRangeDto,
  IpcErrorShape,
  IpcResult,
  ListExpensesInRangeInput,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
} from '../../shared/ipc/types'
import type { Database } from 'better-sqlite3'

const MAX_NAME = 120
const MAX_NOTE = 500

function makeError(code: string, message: string, details?: string): IpcErrorShape {
  return { code, message, details }
}

function asResult<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    if (
      m === 'name_required' ||
      m === 'not_found' ||
      m === 'category_in_use' ||
      m === 'amount_invalid' ||
      m === 'invalid_date_range' ||
      m === 'name_too_long' ||
      m === 'note_too_long'
    ) {
      return { ok: false, error: makeError('validation', m) }
    }
    return { ok: false, error: makeError('internal_error', m) }
  }
}

const ymd = /^\d{4}-\d{2}-\d{2}$/

const norm = (s: string) => s.trim()
const isBlank = (s: string) => s.trim().length === 0

type CatRow = {
  id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

function catToDto(r: CatRow): ExpenseCategoryDto {
  return {
    id: r.id,
    name: r.name,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function listExpenseCategories(db: Database): IpcResult<ExpenseCategoryDto[]> {
  return asResult(() => {
    const st = db.prepare(
      'SELECT * FROM expense_categories ORDER BY sort_order ASC, name COLLATE NOCASE ASC',
    )
    return (st.all() as CatRow[]).map(catToDto)
  })
}

export function createExpenseCategory(
  db: Database,
  input: CreateExpenseCategoryInput,
): IpcResult<ExpenseCategoryDto> {
  if (isBlank(input.name)) {
    return { ok: false, error: makeError('validation', 'name_required') }
  }
  return asResult(() => {
    const name = norm(input.name)
    if (name.length > MAX_NAME) {
      throw new Error('name_too_long')
    }
    const id = randomUUID()
    const now = new Date().toISOString()
    const sortOrder =
      input.sortOrder != null && Number.isInteger(input.sortOrder) ? input.sortOrder : 0
    db.prepare(
      `INSERT INTO expense_categories (id, name, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, name, sortOrder, now, now)
    const r = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id) as CatRow
    return catToDto(r)
  })
}

export function updateExpenseCategory(
  db: Database,
  id: string,
  input: UpdateExpenseCategoryInput,
): IpcResult<ExpenseCategoryDto> {
  if (isBlank(id)) {
    return { ok: false, error: makeError('validation', 'not_found') }
  }
  return asResult(() => {
    const existing = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id) as CatRow | undefined
    if (!existing) {
      throw new Error('not_found')
    }
    let name = existing.name
    let sortOrder = existing.sort_order
    if (input.name !== undefined) {
      if (isBlank(input.name)) {
        throw new Error('name_required')
      }
      const t = norm(input.name)
      if (t.length > MAX_NAME) {
        throw new Error('name_too_long')
      }
      name = t
    }
    if (input.sortOrder !== undefined && Number.isInteger(input.sortOrder)) {
      sortOrder = input.sortOrder
    }
    const now = new Date().toISOString()
    db.prepare(
      'UPDATE expense_categories SET name = ?, sort_order = ?, updated_at = ? WHERE id = ?',
    ).run(name, sortOrder, now, id)
    const r = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id) as CatRow
    return catToDto(r)
  })
}

export function deleteExpenseCategory(db: Database, id: string): IpcResult<null> {
  if (isBlank(id)) {
    return { ok: false, error: makeError('validation', 'not_found') }
  }
  return asResult(() => {
    const n = db.prepare('SELECT 1 as x FROM expenses WHERE category_id = ? LIMIT 1').get(id) as
      | { x: number }
      | undefined
    if (n) {
      throw new Error('category_in_use')
    }
    const del = db.prepare('DELETE FROM expense_categories WHERE id = ?').run(id)
    if (del.changes === 0) {
      throw new Error('not_found')
    }
    return null
  })
}

type ExpRow = {
  id: string
  category_id: string
  amount_lbp: number
  spent_at: string
  note: string | null
  paid_from_cash: number
  created_at: string
  category_name: string
}

export function listExpensesInRange(
  db: Database,
  input: ListExpensesInRangeInput,
): IpcResult<ExpenseDto[]> {
  const from = (input.fromDate ?? '').trim()
  const to = (input.toDate ?? '').trim()
  if (!ymd.test(from) || !ymd.test(to) || from > to) {
    return { ok: false, error: makeError('validation', 'invalid_date_range') }
  }
  return asResult(() => {
    const rows = db
      .prepare(
        `SELECT e.id, e.category_id, e.amount_lbp, e.spent_at, e.note, e.paid_from_cash, e.created_at,
                c.name AS category_name
         FROM expenses e
         INNER JOIN expense_categories c ON c.id = e.category_id
         WHERE date(e.spent_at) >= @fromD AND date(e.spent_at) <= @toD
         ORDER BY e.spent_at DESC, e.created_at DESC`,
      )
      .all({ fromD: from, toD: to }) as ExpRow[]
    return rows.map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      categoryName: r.category_name,
      amountLbp: r.amount_lbp,
      spentAt: r.spent_at,
      note: r.note,
      paidFromCash: r.paid_from_cash === 1,
      createdAt: r.created_at,
    }))
  })
}

export function getExpenseTotalInRange(
  db: Database,
  input: ListExpensesInRangeInput,
): IpcResult<ExpenseTotalInRangeDto> {
  const from = (input.fromDate ?? '').trim()
  const to = (input.toDate ?? '').trim()
  if (!ymd.test(from) || !ymd.test(to) || from > to) {
    return { ok: false, error: makeError('validation', 'invalid_date_range') }
  }
  return asResult(() => {
    const st = db.prepare(
      `SELECT COALESCE(SUM(amount_lbp), 0) AS t FROM expenses
       WHERE date(spent_at) >= @fromD AND date(spent_at) <= @toD`,
    )
    const t = (st.get({ fromD: from, toD: to }) as { t: number }).t
    return { fromDate: from, toDate: to, totalLbp: t }
  })
}

export function createExpense(db: Database, input: CreateExpenseInput): IpcResult<ExpenseDto> {
  return asResult(() => {
    const catId = (input.categoryId ?? '').trim()
    const cat = db.prepare('SELECT name FROM expense_categories WHERE id = ?').get(catId) as
      | { name: string }
      | undefined
    if (!cat) {
      throw new Error('not_found')
    }
    const amount = Math.floor(Number(input.amountLbp))
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error('amount_invalid')
    }
    const spentAt = (input.spentAt ?? '').trim()
    if (spentAt.length === 0) {
      throw new Error('invalid_date_range')
    }
    const noteRaw = (input.note ?? '').trim()
    const note = noteRaw.length === 0 ? null : noteRaw
    if (note != null && note.length > MAX_NOTE) {
      throw new Error('note_too_long')
    }
    const paidFromCash = input.paidFromCash === false ? 0 : 1
    const now = new Date().toISOString()
    const id = randomUUID()
    db.prepare(
      `INSERT INTO expenses (id, category_id, amount_lbp, spent_at, note, paid_from_cash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, catId, amount, spentAt, note, paidFromCash, now)
    return {
      id,
      categoryId: catId,
      categoryName: cat.name,
      amountLbp: amount,
      spentAt,
      note,
      paidFromCash: paidFromCash === 1,
      createdAt: now,
    }
  })
}

export function updateExpense(db: Database, id: string, input: UpdateExpenseInput): IpcResult<ExpenseDto> {
  return asResult(() => {
    const eid = (id ?? '').trim()
    const row = db
      .prepare(
        `SELECT e.id, e.category_id, e.amount_lbp, e.spent_at, e.note, e.paid_from_cash, e.created_at,
                c.name AS category_name
         FROM expenses e
         INNER JOIN expense_categories c ON c.id = e.category_id
         WHERE e.id = ?`,
      )
      .get(eid) as ExpRow | undefined
    if (!row) {
      throw new Error('not_found')
    }
    let categoryId = row.category_id
    let categoryName = row.category_name
    let amountLbp = row.amount_lbp
    let spentAt = row.spent_at
    let note = row.note
    let paidFromCash = row.paid_from_cash

    if (input.categoryId !== undefined) {
      const cid = String(input.categoryId).trim()
      const c = db.prepare('SELECT name FROM expense_categories WHERE id = ?').get(cid) as
        | { name: string }
        | undefined
      if (!c) {
        throw new Error('not_found')
      }
      categoryId = cid
      categoryName = c.name
    }
    if (input.amountLbp !== undefined) {
      const a = Math.floor(Number(input.amountLbp))
      if (!Number.isInteger(a) || a < 1) {
        throw new Error('amount_invalid')
      }
      amountLbp = a
    }
    if (input.spentAt !== undefined) {
      const s = String(input.spentAt).trim()
      if (s.length === 0) {
        throw new Error('invalid_date_range')
      }
      spentAt = s
    }
    if (input.note !== undefined) {
      const t = String(input.note ?? '').trim()
      note = t.length === 0 ? null : t
      if (note != null && note.length > MAX_NOTE) {
        throw new Error('note_too_long')
      }
    }
    if (input.paidFromCash !== undefined) {
      paidFromCash = input.paidFromCash ? 1 : 0
    }
    db.prepare(
      `UPDATE expenses SET category_id = ?, amount_lbp = ?, spent_at = ?, note = ?, paid_from_cash = ?
       WHERE id = ?`,
    ).run(categoryId, amountLbp, spentAt, note, paidFromCash, eid)
    return {
      id: eid,
      categoryId,
      categoryName,
      amountLbp,
      spentAt,
      note,
      paidFromCash: paidFromCash === 1,
      createdAt: row.created_at,
    }
  })
}

export function deleteExpense(db: Database, id: string): IpcResult<null> {
  return asResult(() => {
    const eid = (id ?? '').trim()
    const n = db.prepare('DELETE FROM expenses WHERE id = ?').run(eid).changes
    if (n !== 1) {
      throw new Error('not_found')
    }
    return null
  })
}
