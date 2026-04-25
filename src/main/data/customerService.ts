import { randomUUID } from 'node:crypto'
import type { CreateCustomerInput, CustomerBalanceRow, CustomerDto, IpcErrorShape, IpcResult } from '../../shared/ipc/types'
import type { Database } from 'better-sqlite3'

type CustomerRow = {
  id: string
  name: string
  phone: string | null
  created_at: string
  updated_at: string
}

type BalanceRow = CustomerRow & {
  balance_lbp: number
  last_debt_at: string | null
}

function makeError(code: string, message: string, details?: string): IpcErrorShape {
  return { code, message, details }
}

function asResult<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    if (m === 'name_required') {
      return { ok: false, error: makeError('validation', m) }
    }
    return { ok: false, error: makeError('internal_error', m) }
  }
}

function toDto(r: CustomerRow): CustomerDto {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const isBlank = (s: string) => s.trim().length === 0

export function listCustomers(db: Database): IpcResult<CustomerDto[]> {
  return asResult(() => {
    const st = db.prepare('SELECT * FROM customers ORDER BY name COLLATE NOCASE')
    return (st.all() as CustomerRow[]).map(toDto)
  })
}

/** Customers with balance from sum of on-account (debt) sales; last on-account sale time for UI. */
export function listCustomerBalances(db: Database): IpcResult<CustomerBalanceRow[]> {
  return asResult(() => {
    const st = db.prepare(
      `SELECT
         c.id,
         c.name,
         c.phone,
         c.created_at,
         c.updated_at,
         COALESCE(SUM(CASE WHEN s.payment_type = 'debt' THEN s.total_lbp END), 0) AS balance_lbp,
         MAX(CASE WHEN s.payment_type = 'debt' THEN s.created_at END) AS last_debt_at
       FROM customers c
       LEFT JOIN sales s ON s.customer_id = c.id
       GROUP BY c.id, c.name, c.phone, c.created_at, c.updated_at
       ORDER BY c.name COLLATE NOCASE`,
    )
    const rows = st.all() as BalanceRow[]
    return rows.map((r) => ({
      ...toDto(r),
      balanceLbp: r.balance_lbp,
      lastDebtSaleAt: r.last_debt_at,
    }))
  })
}

export function createCustomer(db: Database, input: CreateCustomerInput): IpcResult<CustomerDto> {
  if (isBlank(input.name)) {
    return { ok: false, error: makeError('validation', 'name_required') }
  }
  return asResult(() => {
    const now = new Date().toISOString()
    const ph =
      input.phone != null && String(input.phone).trim() ? String(input.phone).trim() : null
    const id = insertCustomerRow(db, input.name, ph, now)
    const r = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as CustomerRow
    return toDto(r)
  })
}

export function getCustomerById(db: Database, id: string): CustomerDto | null {
  const r = db.prepare('SELECT * FROM customers WHERE id = ?').get(id.trim()) as CustomerRow | undefined
  return r ? toDto(r) : null
}

/**
 * Insert one customer; used from `completeDebtSale` inside an outer database transaction.
 */
export function insertCustomerRow(db: Database, name: string, phone: string | null, now: string): string {
  const n = name.trim()
  if (isBlank(n)) {
    throw new Error('name_required')
  }
  const ph = phone != null && String(phone).trim() ? String(phone).trim() : null
  const id = randomUUID()
  db.prepare(
    `INSERT INTO customers (id, name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, n, ph, now, now)
  return id
}
