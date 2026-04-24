import { randomUUID } from 'node:crypto'
import type { CompleteCashSaleResult, IpcErrorShape, IpcResult, PosSaleLineInput } from '../../shared/ipc/types'
import type { Database } from 'better-sqlite3'

function makeError(code: string, message: string, details?: string): IpcErrorShape {
  return { code, message, details }
}

function asResult<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    if (
      m === 'empty_lines' ||
      m === 'invalid_line' ||
      m === 'product_not_found' ||
      m === 'insufficient_stock'
    ) {
      return { ok: false, error: makeError('validation', m) }
    }
    return { ok: false, error: makeError('internal_error', m) }
  }
}

type ProductRow = { id: string; name: string; price_lbp: number; stock: number }

function mergeLines(lines: PosSaleLineInput[]): { productId: string; quantity: number }[] {
  const m = new Map<string, number>()
  for (const l of lines) {
    const id = l.productId.trim()
    if (!id) {
      continue
    }
    const q = l.quantity
    if (!Number.isInteger(q) || q <= 0) {
      throw new Error('invalid_line')
    }
    m.set(id, (m.get(id) ?? 0) + q)
  }
  if (m.size === 0) {
    throw new Error('empty_lines')
  }
  return [...m.entries()].map(([productId, quantity]) => ({ productId, quantity }))
}

/**
 * Record a cash sale, persist lines with price snapshot, and decrement product stock in one transaction.
 */
export function completeCashSale(
  db: Database,
  lines: PosSaleLineInput[],
): IpcResult<CompleteCashSaleResult> {
  return asResult(() => {
    const merged = mergeLines(lines)

    const stGet = db.prepare('SELECT id, name, price_lbp, stock FROM products WHERE id = ?')
    const now = new Date().toISOString()
    const saleId = randomUUID()

    type Prepared = {
      productId: string
      quantity: number
      name: string
      unit: number
      lineTotal: number
    }
    const prepared: Prepared[] = []
    for (const row of merged) {
      const p = stGet.get(row.productId) as ProductRow | undefined
      if (!p) {
        throw new Error('product_not_found')
      }
      if (p.stock < row.quantity) {
        throw new Error('insufficient_stock')
      }
      const lineTotal = p.price_lbp * row.quantity
      prepared.push({
        productId: p.id,
        quantity: row.quantity,
        name: p.name,
        unit: p.price_lbp,
        lineTotal,
      })
    }

    const totalLbp = prepared.reduce((s, x) => s + x.lineTotal, 0)

    const tx = db.transaction(() => {
      db.prepare(
        'INSERT INTO sales (id, created_at, total_lbp, payment_type) VALUES (?, ?, ?, ?)',
      ).run(saleId, now, totalLbp, 'cash')

      const stLine = db.prepare(
        `INSERT INTO sale_lines
          (id, sale_id, product_id, product_name, quantity, unit_price_lbp, line_total_lbp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      const stDec = db.prepare(
        `UPDATE products
         SET stock = stock - @q, updated_at = @u
         WHERE id = @id AND stock >= @q`,
      )
      for (const line of prepared) {
        stLine.run(
          randomUUID(),
          saleId,
          line.productId,
          line.name,
          line.quantity,
          line.unit,
          line.lineTotal,
        )
        const n = stDec.run({ id: line.productId, q: line.quantity, u: now })
        if (n.changes !== 1) {
          throw new Error('insufficient_stock')
        }
      }
    })
    tx()

    return { saleId, totalLbp, createdAt: now }
  })
}
