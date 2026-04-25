import { randomUUID } from 'node:crypto'
import type {
  CompleteCashSaleResult,
  CompleteDebtSaleInput,
  IpcErrorShape,
  IpcResult,
  PosSaleLineInput,
  SaleLineViewDto,
} from '../../shared/ipc/types'
import type { Database } from 'better-sqlite3'
import { getCustomerById, insertCustomerRow } from './customerService'

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
      m === 'insufficient_stock' ||
      m === 'customer_not_found' ||
      m === 'name_required' ||
      m === 'sale_not_found' ||
      m === 'not_cash_sale' ||
      m === 'already_voided' ||
      m === 'void_not_same_day'
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
  actorUserId: string | null,
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
        'INSERT INTO sales (id, created_at, total_lbp, payment_type, created_by_user_id) VALUES (?, ?, ?, ?, ?)',
      ).run(saleId, now, totalLbp, 'cash', actorUserId)

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

/**
 * Record a sale on account, persist with customer, decrement stock; same line rules as cash.
 */
export function completeDebtSale(
  db: Database,
  input: CompleteDebtSaleInput,
  actorUserId: string | null,
): IpcResult<CompleteCashSaleResult> {
  return asResult(() => {
    const merged = mergeLines(input.lines)
    const stGet = db.prepare('SELECT id, name, price_lbp, stock FROM products WHERE id = ?')
    const now = new Date().toISOString()
    const saleId = randomUUID()
    const noteTrim = (input.note ?? '').trim() || null

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
      let customerId: string
      if (input.mode === 'new') {
        const ph =
          input.customerPhone != null && String(input.customerPhone).trim()
            ? String(input.customerPhone).trim()
            : null
        customerId = insertCustomerRow(db, input.customerName, ph, now, actorUserId)
      } else {
        const c = getCustomerById(db, input.customerId)
        if (!c) {
          throw new Error('customer_not_found')
        }
        customerId = c.id
      }

      db.prepare(
        `INSERT INTO sales (id, created_at, total_lbp, payment_type, customer_id, note, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(saleId, now, totalLbp, 'debt', customerId, noteTrim, actorUserId)

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

/**
 * Lines for one on-account sale, scoped to the customer (so IDs cannot be probed across customers).
 */
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

/**
 * Void a cash sale from today (local calendar): mark voided_at and restore catalog stock.
 */
export function voidCashSale(db: Database, saleId: string): IpcResult<{ saleId: string }> {
  return asResult(() => {
    const sid = (saleId ?? '').trim()
    if (!sid) {
      throw new Error('sale_not_found')
    }
    const row = db
      .prepare(
        `SELECT id, created_at, payment_type, voided_at FROM sales WHERE id = ?`,
      )
      .get(sid) as
      | { id: string; created_at: string; payment_type: string; voided_at: string | null }
      | undefined
    if (!row) {
      throw new Error('sale_not_found')
    }
    if (row.payment_type !== 'cash') {
      throw new Error('not_cash_sale')
    }
    if (row.voided_at != null && String(row.voided_at).trim() !== '') {
      throw new Error('already_voided')
    }
    if (localYmdFromIso(row.created_at) !== todayLocalYmd()) {
      throw new Error('void_not_same_day')
    }
    const now = new Date().toISOString()
    const lines = db
      .prepare(
        `SELECT product_id, quantity FROM sale_lines WHERE sale_id = ?`,
      )
      .all(sid) as { product_id: string; quantity: number }[]

    const tx = db.transaction(() => {
      const stInc = db.prepare(
        `UPDATE products SET stock = stock + @q, updated_at = @u WHERE id = @id`,
      )
      for (const ln of lines) {
        stInc.run({ id: ln.product_id, q: ln.quantity, u: now })
      }
      db.prepare('UPDATE sales SET voided_at = ? WHERE id = ?').run(now, sid)
    })
    tx()
    return { saleId: sid }
  })
}

export function getDebtSaleLines(
  db: Database,
  customerId: string,
  saleId: string,
): IpcResult<SaleLineViewDto[]> {
  const c = (customerId ?? '').trim()
  const s = (saleId ?? '').trim()
  if (c.length === 0 || s.length === 0) {
    return { ok: false, error: makeError('validation', 'invalid_input') }
  }
  const header = db
    .prepare(
      `SELECT id FROM sales WHERE id = ? AND customer_id = ? AND payment_type = 'debt'`,
    )
    .get(s, c) as { id: string } | undefined
  if (!header) {
    return { ok: false, error: makeError('validation', 'sale_not_found') }
  }
  const rows = db
    .prepare(
      `SELECT
         id,
         product_id,
         product_name,
         quantity,
         unit_price_lbp,
         line_total_lbp
       FROM sale_lines
       WHERE sale_id = ?
       ORDER BY id`,
    )
    .all(s) as {
    id: string
    product_id: string
    product_name: string
    quantity: number
    unit_price_lbp: number
    line_total_lbp: number
  }[]
  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      quantity: r.quantity,
      unitPriceLbp: r.unit_price_lbp,
      lineTotalLbp: r.line_total_lbp,
    })),
  }
}
