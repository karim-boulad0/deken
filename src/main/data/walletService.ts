import type { Database } from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { IpcResult } from '../../shared/ipc/types'

export interface WalletSessionDto {
  id: string
  openedAt: string
  closedAt: string | null
  openingBalanceLbp: number
  actualClosingBalanceLbp: number | null
  expectedClosingBalanceLbp: number | null
  createdByUserId: string
}

export interface WalletTransactionDto {
  id: string
  sessionId: string
  amountLbp: number
  type: 'IN' | 'OUT'
  reason: string | null
  createdAt: string
  createdByUserId: string
}

export function getActiveWalletSession(db: Database): IpcResult<WalletSessionDto | null> {
  try {
    const row = db
      .prepare('SELECT * FROM wallet_sessions WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1')
      .get() as any

    if (!row) return { ok: true, data: null }

    return {
      ok: true,
      data: {
        id: row.id,
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        openingBalanceLbp: row.opening_balance_lbp,
        actualClosingBalanceLbp: row.actual_closing_balance_lbp,
        expectedClosingBalanceLbp: row.expected_closing_balance_lbp,
        createdByUserId: row.created_by_user_id,
      },
    }
  } catch (err) {
    return { ok: false, error: { code: 'database', message: String(err) } }
  }
}

export function openWalletSession(
  db: Database,
  openingBalanceLbp: number,
  userId: string,
): IpcResult<WalletSessionDto> {
  try {
    const active = getActiveWalletSession(db)
    if (active.ok && active.data) {
      return { ok: false, error: { code: 'validation', message: 'session_already_active' } }
    }

    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO wallet_sessions (id, opened_at, opening_balance_lbp, created_by_user_id)
       VALUES (?, ?, ?, ?)`,
    ).run(id, now, openingBalanceLbp, userId)

    return {
      ok: true,
      data: {
        id,
        openedAt: now,
        closedAt: null,
        openingBalanceLbp,
        actualClosingBalanceLbp: null,
        expectedClosingBalanceLbp: null,
        createdByUserId: userId,
      },
    }
  } catch (err) {
    return { ok: false, error: { code: 'database', message: String(err) } }
  }
}

export function addWalletTransaction(
  db: Database,
  input: { sessionId: string; amountLbp: number; type: 'IN' | 'OUT'; reason?: string },
  userId: string,
): IpcResult<WalletTransactionDto> {
  try {
    // Validate: for OUT transactions, check we have enough balance
    if (input.type === 'OUT') {
      const balanceRes = getWalletBalance(db, input.sessionId)
      if (!balanceRes.ok) return balanceRes as any
      if (input.amountLbp > balanceRes.data) {
        return {
          ok: false,
          error: { code: 'validation', message: 'insufficient_balance' },
        }
      }
    }

    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO wallet_transactions (id, session_id, amount_lbp, type, reason, created_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.sessionId, input.amountLbp, input.type, input.reason || null, now, userId)

    return {
      ok: true,
      data: {
        id,
        sessionId: input.sessionId,
        amountLbp: input.amountLbp,
        type: input.type,
        reason: input.reason || null,
        createdAt: now,
        createdByUserId: userId,
      },
    }
  } catch (err) {
    return { ok: false, error: { code: 'database', message: String(err) } }
  }
}

export function listWalletTransactions(
  db: Database,
  sessionId: string,
): IpcResult<WalletTransactionDto[]> {
  try {
    const rows = db
      .prepare('SELECT * FROM wallet_transactions WHERE session_id = ? ORDER BY created_at DESC')
      .all(sessionId) as any[]

    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        sessionId: r.session_id,
        amountLbp: r.amount_lbp,
        type: r.type,
        reason: r.reason,
        createdAt: r.created_at,
        createdByUserId: r.created_by_user_id,
      })),
    }
  } catch (err) {
    return { ok: false, error: { code: 'database', message: String(err) } }
  }
}

export function getWalletBalance(db: Database, sessionId: string): IpcResult<number> {
  try {
    const session = db
      .prepare('SELECT opening_balance_lbp, opened_at FROM wallet_sessions WHERE id = ?')
      .get(sessionId) as { opening_balance_lbp: number; opened_at: string } | undefined

    if (!session) return { ok: false, error: { code: 'not_found', message: 'session_not_found' } }

    // 1. Opening
    let balance = Number(session.opening_balance_lbp) || 0

    // 2. Cash sales (not debt, not voided) since session opened
    try {
      const row = db
        .prepare("SELECT COALESCE(SUM(total_lbp), 0) as total FROM sales WHERE payment_type = 'cash' AND voided_at IS NULL AND created_at >= ?")
        .get(session.opened_at) as { total: number }
      balance += Number(row.total) || 0
    } catch { /* skip */ }

    // 3. Debt payments (cash collected from customers) since session opened
    try {
      const row = db
        .prepare("SELECT COALESCE(SUM(amount_lbp), 0) as total FROM debt_payments WHERE created_at >= ?")
        .get(session.opened_at) as { total: number }
      balance += Number(row.total) || 0
    } catch { /* skip */ }

    // 4. Manual wallet IN adjustments for this session
    try {
      const row = db
        .prepare("SELECT COALESCE(SUM(amount_lbp), 0) as total FROM wallet_transactions WHERE session_id = ? AND type = 'IN'")
        .get(sessionId) as { total: number }
      balance += Number(row.total) || 0
    } catch { /* skip */ }

    // 5. Manual wallet OUT adjustments for this session
    try {
      const row = db
        .prepare("SELECT COALESCE(SUM(amount_lbp), 0) as total FROM wallet_transactions WHERE session_id = ? AND type = 'OUT'")
        .get(sessionId) as { total: number }
      balance -= Number(row.total) || 0
    } catch { /* skip */ }

    // 6. Expenses paid from cash since session opened
    try {
      const row = db
        .prepare("SELECT COALESCE(SUM(amount_lbp), 0) as total FROM expenses WHERE paid_from_cash = 1 AND spent_at >= ?")
        .get(session.opened_at) as { total: number }
      balance -= Number(row.total) || 0
    } catch { /* table or column missing — skip */ }

    return { ok: true, data: balance }
  } catch (err) {
    return { ok: false, error: { code: 'database', message: String(err) } }
  }
}

export function closeWalletSession(
  db: Database,
  sessionId: string,
  actualClosingBalanceLbp: number,
): IpcResult<WalletSessionDto> {
  try {
    const balanceRes = getWalletBalance(db, sessionId)
    if (!balanceRes.ok) return balanceRes as any

    const expected = balanceRes.data
    const now = new Date().toISOString()

    db.prepare(
      `UPDATE wallet_sessions 
       SET closed_at = ?, actual_closing_balance_lbp = ?, expected_closing_balance_lbp = ?
       WHERE id = ?`,
    ).run(now, actualClosingBalanceLbp, expected, sessionId)

    const row = db.prepare('SELECT * FROM wallet_sessions WHERE id = ?').get(sessionId) as any

    return {
      ok: true,
      data: {
        id: row.id,
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        openingBalanceLbp: row.opening_balance_lbp,
        actualClosingBalanceLbp: row.actual_closing_balance_lbp,
        expectedClosingBalanceLbp: row.expected_closing_balance_lbp,
        createdByUserId: row.created_by_user_id,
      },
    }
  } catch (err) {
    return { ok: false, error: { code: 'database', message: String(err) } }
  }
}
