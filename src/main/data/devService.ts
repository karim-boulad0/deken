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

export function clearTable(db: Database, tableName: string): IpcResult<null> {
  const allowedTables = [
    'products',
    'categories',
    'customers',
    'suppliers',
    'expenses',
    'expense_categories',
    'sales',
    'sale_lines',
    'debt_payments',
    'supplier_invoices',
    'supplier_payments',
    'product_sizes',
    'product_flavors'
  ]

  if (!allowedTables.includes(tableName)) {
    return { ok: false, error: makeError('invalid_table', `Table ${tableName} is not allowed for clearing.`) }
  }

  return asResult(() => {
    db.transaction(() => {
      // Special handling for tables with dependent lines or FK restrictions
      if (tableName === 'sales') {
        db.prepare('DELETE FROM sale_lines').run()
        db.prepare('DELETE FROM sales').run()
      } else if (tableName === 'suppliers') {
        db.prepare('DELETE FROM supplier_payments').run()
        db.prepare('DELETE FROM supplier_invoices').run()
        db.prepare('DELETE FROM suppliers').run()
      } else if (tableName === 'expense_categories') {
        db.prepare('DELETE FROM expenses').run()
        db.prepare('DELETE FROM expense_categories').run()
      } else if (tableName === 'categories') {
        // Categories are referred by products, but not hard FK in v1 migrations usually.
        // If we want to be safe, we could null them out in products first if we don't clear products.
        // But the user asked to clear the table itself.
        db.prepare('DELETE FROM categories').run()
      } else {
        db.prepare(`DELETE FROM ${tableName}`).run()
      }
    })()
    return null
  })
}
