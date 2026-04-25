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
         date(created_at) AS d,
         SUM(total_lbp) AS total_lbp,
         COUNT(*) AS sale_count
       FROM sales
       WHERE date(created_at) >= @fromD AND date(created_at) <= @toD
       GROUP BY date(created_at)
       ORDER BY d`,
    )
    const byDayRaw = stDay.all({ fromD: fromDate, toD: toDate }) as {
      d: string
      total_lbp: number
      sale_count: number
    }[]

    const stType = db.prepare(
      `SELECT
         payment_type,
         COALESCE(SUM(total_lbp), 0) AS s,
         COUNT(*) AS c
       FROM sales
       WHERE date(created_at) >= @fromD AND date(created_at) <= @toD
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
       WHERE date(created_at) >= @fromD AND date(created_at) <= @toD`,
    )
    const totalLbp = (stSum.get({ fromD: fromDate, toD: toDate }) as { t: number }).t

    const byDay: SalesReportDto['byDay'] = byDayRaw.map((x) => ({
      day: x.d,
      totalLbp: x.total_lbp,
      count: x.sale_count,
    }))

    return {
      fromDate,
      toDate,
      totalLbp,
      totalCashLbp,
      totalDebtLbp,
      saleCount,
      byDay,
    }
  })
}
