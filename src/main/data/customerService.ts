import { randomUUID } from 'node:crypto'
import type {
  CreateCustomerInput,
  CustomerBalanceRow,
  CustomerDto,
  CustomerLedgerLineDto,
  IpcErrorShape,
  IpcResult,
  RecordDebtPaymentInput,
  RecordDebtPaymentResult,
} from '../../shared/ipc/types'
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
  last_debt_note: string | null
}

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
      m === 'amount_invalid' ||
      m === 'payment_exceeds_balance' ||
      m === 'no_outstanding_balance' ||
      m === 'customer_not_found'
    ) {
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

function normalizeNote(n: string | null): string | null {
  if (n == null) {
    return null
  }
  const t = String(n).trim()
  return t.length === 0 ? null : t
}

/**
 * Customers with balance = (sum of debt sales) − (sum of debt payments);
 * last on-account sale time and note on the most recent such sale.
 */
export function listCustomerBalances(db: Database): IpcResult<CustomerBalanceRow[]> {
  return asResult(() => {
    const st = db.prepare(
      `SELECT
         c.id,
         c.name,
         c.phone,
         c.created_at,
         c.updated_at,
         (
           SELECT COALESCE(SUM(s.total_lbp), 0)
           FROM sales s
           WHERE s.customer_id = c.id AND s.payment_type = 'debt'
         ) - (
           SELECT COALESCE(SUM(p.amount_lbp), 0)
           FROM debt_payments p
           WHERE p.customer_id = c.id
         ) AS balance_lbp,
         (
           SELECT MAX(s.created_at)
           FROM sales s
           WHERE s.customer_id = c.id AND s.payment_type = 'debt'
         ) AS last_debt_at,
         (
           SELECT s.note
           FROM sales s
           WHERE s.customer_id = c.id AND s.payment_type = 'debt'
           ORDER BY s.created_at DESC
           LIMIT 1
         ) AS last_debt_note
       FROM customers c
       ORDER BY c.name COLLATE NOCASE`,
    )
    const rows = st.all() as BalanceRow[]
    return rows.map((r) => ({
      ...toDto(r),
      balanceLbp: r.balance_lbp,
      lastDebtSaleAt: r.last_debt_at,
      lastDebtNote: normalizeNote(r.last_debt_note),
    }))
  })
}

function getCustomerDebtTotalLbp(db: Database, customerId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(total_lbp), 0) AS t
       FROM sales
       WHERE customer_id = ? AND payment_type = 'debt'`,
    )
    .get(customerId) as { t: number } | undefined
  return row?.t ?? 0
}

function getCustomerPaymentsTotalLbp(db: Database, customerId: string): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(amount_lbp), 0) AS t FROM debt_payments WHERE customer_id = ?`)
    .get(customerId) as { t: number } | undefined
  return row?.t ?? 0
}

export function getCustomerBalanceLbp(db: Database, customerId: string): number {
  const id = customerId.trim()
  return getCustomerDebtTotalLbp(db, id) - getCustomerPaymentsTotalLbp(db, id)
}

/**
 * All on-account sales and all payments for one customer, newest first (with notes on each line).
 */
export function getCustomerLedger(
  db: Database,
  customerId: string,
): IpcResult<CustomerLedgerLineDto[]> {
  const id = (customerId ?? '').trim()
  if (id.length === 0) {
    return { ok: false, error: makeError('validation', 'invalid_input') }
  }
  if (!getCustomerById(db, id)) {
    return { ok: false, error: makeError('validation', 'customer_not_found') }
  }
  return asResult(() => {
    const stSales = db.prepare(
      `SELECT id, created_at, total_lbp, note
       FROM sales
       WHERE customer_id = ? AND payment_type = 'debt'
       ORDER BY created_at DESC`,
    )
    const stPay = db.prepare(
      `SELECT id, created_at, amount_lbp, note
       FROM debt_payments
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
    )
    const sa = stSales.all(id) as { id: string; created_at: string; total_lbp: number; note: string | null }[]
    const pa = stPay.all(id) as { id: string; created_at: string; amount_lbp: number; note: string | null }[]
    const out: CustomerLedgerLineDto[] = [
      ...sa.map((r) => ({
        kind: 'debt_sale' as const,
        id: r.id,
        at: r.created_at,
        amountLbp: r.total_lbp,
        note: normalizeNote(r.note),
      })),
      ...pa.map((r) => ({
        kind: 'payment' as const,
        id: r.id,
        at: r.created_at,
        amountLbp: r.amount_lbp,
        note: normalizeNote(r.note),
      })),
    ]
    out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    return out
  })
}

export function recordDebtPayment(
  db: Database,
  input: RecordDebtPaymentInput,
): IpcResult<RecordDebtPaymentResult> {
  const id = (input.customerId ?? '').trim()
  if (id.length === 0) {
    return { ok: false, error: makeError('validation', 'customer_not_found') }
  }
  if (!Number.isInteger(input.amountLbp) || input.amountLbp < 1) {
    return { ok: false, error: makeError('validation', 'amount_invalid') }
  }
  return asResult(() => {
    const c = getCustomerById(db, id)
    if (!c) {
      throw new Error('customer_not_found')
    }
    const balance = getCustomerBalanceLbp(db, id)
    if (balance <= 0) {
      throw new Error('no_outstanding_balance')
    }
    if (input.amountLbp > balance) {
      throw new Error('payment_exceeds_balance')
    }
    const now = new Date().toISOString()
    const payId = randomUUID()
    const noteTrim = (input.note ?? '').trim() || null
    db.prepare(
      `INSERT INTO debt_payments (id, customer_id, amount_lbp, created_at, note) VALUES (?, ?, ?, ?, ?)`,
    ).run(payId, id, input.amountLbp, now, noteTrim)
    const newBalance = getCustomerBalanceLbp(db, id)
    return { paymentId: payId, newBalanceLbp: newBalance }
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
