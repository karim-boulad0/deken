import type { DashboardSnapshotDto, IpcErrorShape, IpcResult } from '../../shared/ipc/types'
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

/** Products at or below this count (including zero) are listed as alerts. */
export const DASHBOARD_LOW_STOCK_THRESHOLD = 10
const MAX_ALERTS = 8

function localDayBounds(): { startIso: string; endIso: string; dateYmd: string } {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(24, 0, 0, 0)
  const y = start.getFullYear()
  const m = String(start.getMonth() + 1).padStart(2, '0')
  const d = String(start.getDate()).padStart(2, '0')
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    dateYmd: `${y}-${m}-${d}`,
  }
}

/**
 * Today's activity (local midnight → next midnight) + low-stock product rows.
 */
export function getDashboardSnapshot(db: Database): IpcResult<DashboardSnapshotDto> {
  return asResult(() => {
    const { startIso, endIso, dateYmd } = localDayBounds()

    const stSales = db.prepare(
      `SELECT
         COALESCE(SUM(total_lbp), 0) AS t,
         COUNT(*) AS c
       FROM sales
       WHERE created_at >= @s AND created_at < @e`,
    )
    const r = stSales.get({ s: startIso, e: endIso }) as { t: number; c: number }

    const stItems = db.prepare(
      `SELECT COALESCE(SUM(sl.quantity), 0) AS n
       FROM sale_lines sl
       INNER JOIN sales s ON s.id = sl.sale_id
       WHERE s.created_at >= @s AND s.created_at < @e`,
    )
    const n = (stItems.get({ s: startIso, e: endIso }) as { n: number }).n

    const stLow = db.prepare(
      `SELECT id, name, sku, stock
       FROM products
       WHERE stock <= @th
       ORDER BY (stock = 0) DESC, stock ASC, name
       LIMIT @lim`,
    )
    const lowRaw = stLow.all({ th: DASHBOARD_LOW_STOCK_THRESHOLD, lim: MAX_ALERTS }) as {
      id: string
      name: string
      sku: string
      stock: number
    }[]

    return {
      today: {
        dateYmd,
        totalLbp: r.t,
        saleCount: r.c,
        itemsSold: n,
      },
      lowStock: lowRaw.map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        stock: row.stock,
      })),
      lowStockThreshold: DASHBOARD_LOW_STOCK_THRESHOLD,
    }
  })
}
