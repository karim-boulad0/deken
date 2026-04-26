import type { IpcErrorShape, IpcResult, SalesReportDto } from '../../shared/ipc/types'
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

const ymd = /^\d{4}-\d{2}-\d{2}$/

/**
 * Sales totals and per-UTC-day breakdown for [fromDate, toDate] (YYYY-MM-DD) vs `date(created_at)`.
 */
export function getSalesReport(
  db: Database,
  fromDate: string,
  toDate: string,
): IpcResult<SalesReportDto> {
  if (!ymd.test(fromDate) || !ymd.test(toDate) || fromDate > toDate) {
    return { ok: false, error: makeError('validation', 'invalid_date_range') }
  }
  return asResult(() => {
    const stDay = db.prepare(
      `SELECT
         d,
         SUM(total_lbp) AS total_lbp,
         COUNT(*) AS sale_count,
         SUM(gross_profit_lbp) AS gross_profit_lbp
       FROM (
         SELECT 
           date(s.created_at) AS d,
           s.id,
           s.total_lbp,
           COALESCE(SUM(sl.line_total_lbp - (COALESCE(p.base_price_lbp, 0) * sl.quantity)), 0) AS gross_profit_lbp
         FROM sales s
         LEFT JOIN sale_lines sl ON s.id = sl.sale_id
         LEFT JOIN products p ON p.id = sl.product_id
         WHERE s.voided_at IS NULL AND date(s.created_at) >= @fromD AND date(s.created_at) <= @toD
         GROUP BY s.id
       )
       GROUP BY d
       ORDER BY d`,
    )
    const byDayRaw = stDay.all({ fromD: fromDate, toD: toDate }) as {
      d: string
      total_lbp: number
      sale_count: number
      gross_profit_lbp: number
    }[]

    const stType = db.prepare(
      `SELECT
         payment_type,
         COALESCE(SUM(total_lbp), 0) AS s,
         COUNT(*) AS c
       FROM sales
       WHERE voided_at IS NULL AND date(created_at) >= @fromD AND date(created_at) <= @toD
       GROUP BY payment_type`,
    )
    const byType = stType.all({ fromD: fromDate, toD: toDate }) as {
      payment_type: string
      s: number
      c: number
    }[]

    let totalCashLbp = 0
    let totalDebtLbp = 0
    let saleCount = 0
    for (const r of byType) {
      saleCount += r.c
      if (r.payment_type === 'cash') {
        totalCashLbp += r.s
      } else if (r.payment_type === 'debt') {
        totalDebtLbp += r.s
      }
    }

    const stSum = db.prepare(
      `SELECT COALESCE(SUM(total_lbp), 0) AS t FROM sales
       WHERE voided_at IS NULL AND date(created_at) >= @fromD AND date(created_at) <= @toD`,
    )
    const totalLbp = (stSum.get({ fromD: fromDate, toD: toDate }) as { t: number }).t

    const stGrossProfit = db.prepare(
      `SELECT
         COALESCE(SUM(sl.line_total_lbp), 0) AS sales_total,
         COALESCE(SUM(COALESCE(p.base_price_lbp, 0) * sl.quantity), 0) AS cost_total
       FROM sale_lines sl
       INNER JOIN sales s ON s.id = sl.sale_id
       LEFT JOIN products p ON p.id = sl.product_id
       WHERE s.voided_at IS NULL
         AND date(s.created_at) >= @fromD
         AND date(s.created_at) <= @toD`,
    )
    const gp = stGrossProfit.get({ fromD: fromDate, toD: toDate }) as { sales_total: number; cost_total: number }
    const grossProfitLbp = gp.sales_total - gp.cost_total
    const grossMarginPct = gp.sales_total > 0 ? (grossProfitLbp / gp.sales_total) * 100 : null

    const byDay: SalesReportDto['byDay'] = byDayRaw.map((x) => ({
      day: x.d,
      totalLbp: x.total_lbp,
      count: x.sale_count,
      grossProfitLbp: x.gross_profit_lbp,
    }))

    return {
      fromDate,
      toDate,
      totalLbp,
      totalCashLbp,
      totalDebtLbp,
      saleCount,
      grossProfitLbp,
      grossMarginPct,
      byDay,
    }
  })
}
