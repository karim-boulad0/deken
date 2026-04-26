import type { Database } from 'better-sqlite3'
import type { IpcErrorShape, IpcResult } from '../../shared/ipc/types'

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

/**
 * Empties transactions: sales, sale_lines, debt_payments, expenses, supplier_payments, supplier_invoices.
 * Leaves products, customers, suppliers, categories, settings intact.
 */
export function clearAllTransactions(db: Database): IpcResult<null> {
  return asResult(() => {
    db.transaction(() => {
      db.prepare('DELETE FROM sale_lines').run()
      db.prepare('DELETE FROM sales').run()
      db.prepare('DELETE FROM expenses').run()
      db.prepare('DELETE FROM debt_payments').run()
      db.prepare('DELETE FROM supplier_payments').run()
      db.prepare('DELETE FROM supplier_invoices').run()
    })()
    return null
  })
}
