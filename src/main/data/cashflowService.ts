import type { CashflowLineDto, IpcErrorShape, IpcResult, ListRecentCashflowInput } from '../../shared/ipc/types'
import type { Database } from 'better-sqlite3'

function makeError(code: string, message: string, details?: string): IpcErrorShape {
  return { code, message, details }
}

function asResult<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    return { ok: false, error: makeError('internal_error', m) }
  }
}

function localYmdFromIso(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function todayLocalYmd(): string {
  return localYmdFromIso(new Date().toISOString())
}

type RawLine = {
  rowKey: string
  at: string
  kind: CashflowLineDto['kind']
  amountSignedLbp: number
  primaryLabel: string | null
  secondaryLabel: string | null
  actorId: string | null
  actorUsername: string | null
  actorFullName: string | null
  saleId: string | null
}

/**
 * Newest-first merged feed for POS / drawer review. Limit clamped 5–20.
 */
export function listRecentCashflow(
  db: Database,
  input: ListRecentCashflowInput,
): IpcResult<CashflowLineDto[]> {
  return asResult(() => {
    const rawLim = Math.floor(Number(input.limit))
    const lim = Number.isFinite(rawLim) ? Math.min(20, Math.max(5, rawLim)) : 10
    const fetchCap = lim

    const cashSales = db
      .prepare(
        `SELECT
           s.id,
           s.created_at,
           s.total_lbp,
           u.id AS actor_id,
           u.username AS actor_username,
           u.full_name AS actor_full_name
         FROM sales s
         LEFT JOIN users u ON u.id = s.created_by_user_id
         WHERE payment_type = 'cash' AND voided_at IS NULL
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(fetchCap) as {
      id: string
      created_at: string
      total_lbp: number
      actor_id: string | null
      actor_username: string | null
      actor_full_name: string | null
    }[]

    const debtSales = db
      .prepare(
        `SELECT
           s.id,
           s.created_at,
           s.total_lbp,
           c.name AS customer_name,
           u.id AS actor_id,
           u.username AS actor_username,
           u.full_name AS actor_full_name
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN users u ON u.id = s.created_by_user_id
         WHERE s.payment_type = 'debt'
         ORDER BY s.created_at DESC
         LIMIT ?`,
      )
      .all(fetchCap) as {
      id: string
      created_at: string
      total_lbp: number
      customer_name: string | null
      actor_id: string | null
      actor_username: string | null
      actor_full_name: string | null
    }[]

    const debtPayments = db
      .prepare(
        `SELECT p.id, p.created_at, p.amount_lbp, p.note, c.name AS customer_name,
                u.id AS actor_id, u.username AS actor_username, u.full_name AS actor_full_name
         FROM debt_payments p
         INNER JOIN customers c ON c.id = p.customer_id
         LEFT JOIN users u ON u.id = p.created_by_user_id
         ORDER BY p.created_at DESC
         LIMIT ?`,
      )
      .all(fetchCap) as {
      id: string
      created_at: string
      amount_lbp: number
      note: string | null
      customer_name: string
      actor_id: string | null
      actor_username: string | null
      actor_full_name: string | null
    }[]

    const supplierPayments = db
      .prepare(
        `SELECT p.id, p.created_at, p.amount_lbp, p.note, s.name AS supplier_name,
                u.id AS actor_id, u.username AS actor_username, u.full_name AS actor_full_name
         FROM supplier_payments p
         INNER JOIN suppliers s ON s.id = p.supplier_id
         LEFT JOIN users u ON u.id = p.created_by_user_id
         ORDER BY p.created_at DESC
         LIMIT ?`,
      )
      .all(fetchCap) as {
      id: string
      created_at: string
      amount_lbp: number
      note: string | null
      supplier_name: string
      actor_id: string | null
      actor_username: string | null
      actor_full_name: string | null
    }[]

    const expenses = db
      .prepare(
        `SELECT e.id, e.spent_at, e.amount_lbp, e.note, c.name AS category_name,
                u.id AS actor_id, u.username AS actor_username, u.full_name AS actor_full_name
         FROM expenses e
         INNER JOIN expense_categories c ON c.id = e.category_id
         LEFT JOIN users u ON u.id = e.created_by_user_id
         ORDER BY e.spent_at DESC, e.created_at DESC
         LIMIT ?`,
      )
      .all(fetchCap) as {
      id: string
      spent_at: string
      amount_lbp: number
      note: string | null
      category_name: string
      actor_id: string | null
      actor_username: string | null
      actor_full_name: string | null
    }[]

    const merged: RawLine[] = []
    const todayYmd = todayLocalYmd()

    for (const r of cashSales) {
      merged.push({
        rowKey: `cash_sale:${r.id}`,
        at: r.created_at,
        kind: 'cash_sale',
        amountSignedLbp: r.total_lbp,
        primaryLabel: null,
        secondaryLabel: null,
        actorId: r.actor_id,
        actorUsername: r.actor_username,
        actorFullName: r.actor_full_name,
        saleId: r.id,
      })
    }
    for (const r of debtSales) {
      merged.push({
        rowKey: `debt_sale:${r.id}`,
        at: r.created_at,
        kind: 'debt_sale',
        amountSignedLbp: r.total_lbp,
        primaryLabel: r.customer_name ?? null,
        secondaryLabel: null,
        actorId: r.actor_id,
        actorUsername: r.actor_username,
        actorFullName: r.actor_full_name,
        saleId: r.id,
      })
    }
    for (const r of debtPayments) {
      merged.push({
        rowKey: `debt_payment:${r.id}`,
        at: r.created_at,
        kind: 'debt_payment',
        amountSignedLbp: r.amount_lbp,
        primaryLabel: r.customer_name,
        secondaryLabel: r.note,
        actorId: r.actor_id,
        actorUsername: r.actor_username,
        actorFullName: r.actor_full_name,
        saleId: null,
      })
    }
    for (const r of supplierPayments) {
      merged.push({
        rowKey: `supplier_payment:${r.id}`,
        at: r.created_at,
        kind: 'supplier_payment',
        amountSignedLbp: -r.amount_lbp,
        primaryLabel: r.supplier_name,
        secondaryLabel: r.note,
        actorId: r.actor_id,
        actorUsername: r.actor_username,
        actorFullName: r.actor_full_name,
        saleId: null,
      })
    }
    for (const r of expenses) {
      merged.push({
        rowKey: `expense:${r.id}`,
        at: r.spent_at,
        kind: 'expense',
        amountSignedLbp: -r.amount_lbp,
        primaryLabel: r.category_name,
        secondaryLabel: r.note,
        actorId: r.actor_id,
        actorUsername: r.actor_username,
        actorFullName: r.actor_full_name,
        saleId: null,
      })
    }

    merged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))

    const out: CashflowLineDto[] = []
    for (const r of merged) {
      if (out.length >= lim) {
        break
      }
      const saleYmd = r.saleId ? localYmdFromIso(r.at) : ''
      const canVoid =
        r.kind === 'cash_sale' &&
        r.saleId != null &&
        saleYmd === todayYmd
      out.push({
        rowKey: r.rowKey,
        at: r.at,
        kind: r.kind,
        amountSignedLbp: r.amountSignedLbp,
        primaryLabel: r.primaryLabel,
        secondaryLabel: r.secondaryLabel,
        actor:
          r.actorId != null && r.actorUsername != null && r.actorFullName != null
            ? { id: r.actorId, username: r.actorUsername, fullName: r.actorFullName }
            : null,
        saleId: r.saleId,
        canVoid,
      })
    }
    return out
  })
}
