import type {
  DashboardRange,
  DashboardSmartAlertDto,
  DashboardSnapshotDto,
  DashboardSnapshotInput,
  DashboardTaskDto,
  IpcErrorShape,
  IpcResult,
} from '../../shared/ipc/types'
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
const MAX_SMART_ALERTS = 3
const MAX_TASKS = 5
const HIGH_DEBT_BALANCE_LBP = 10_000_000
const HIGH_SUPPLIER_PAYABLE_LBP = 12_000_000
const EXPENSE_SPIKE_MIN_LBP = 1_500_000
const EXPENSE_SPIKE_RATIO = 1.5

type PeriodBounds = {
  startIso: string
  endIso: string
  startDateYmd: string
  endDateYmd: string
  days: number
}

function localDayStart(daysOffset = 0): Date {
  const now = new Date()
  now.setDate(now.getDate() + daysOffset)
  now.setHours(0, 0, 0, 0)
  return now
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rangeDays(range: DashboardRange): number {
  if (range === '7d') return 7
  if (range === '30d') return 30
  return 1
}

function localPeriodBounds(range: DashboardRange, periodsBack = 0): PeriodBounds {
  const days = rangeDays(range)
  const shiftDays = periodsBack * days
  const endExclusive = localDayStart(1 - shiftDays)
  const start = new Date(endExclusive)
  start.setDate(start.getDate() - days)
  const endInclusive = new Date(endExclusive)
  endInclusive.setDate(endInclusive.getDate() - 1)
  return {
    startIso: start.toISOString(),
    endIso: endExclusive.toISOString(),
    startDateYmd: ymd(start),
    endDateYmd: ymd(endInclusive),
    days,
  }
}

function scoreAlert(a: DashboardSmartAlertDto): number {
  const sev = a.severity === 'high' ? 2 : 1
  return sev * 1_000_000_000 + Math.max(0, Math.floor(a.value))
}

function taskScore(t: DashboardTaskDto): number {
  const sev = t.severity === 'high' ? 2 : 1
  return sev * 1_000_000_000 + Math.max(0, Math.floor(t.value))
}

function buildTasks(alerts: DashboardSmartAlertDto[]): DashboardTaskDto[] {
  const tasks: DashboardTaskDto[] = []
  for (const alert of alerts) {
    if (alert.kind === 'customer_debt') {
      tasks.push({
        id: `task:customer_debt:${alert.id}`,
        kind: 'collect_customer_debt',
        severity: alert.severity,
        label: alert.label,
        value: alert.value,
        routeTo: '/debts',
      })
    } else if (alert.kind === 'supplier_payable') {
      tasks.push({
        id: `task:supplier_payable:${alert.id}`,
        kind: 'pay_supplier',
        severity: alert.severity,
        label: alert.label,
        value: alert.value,
        routeTo: '/suppliers',
      })
    } else if (alert.kind === 'low_stock') {
      tasks.push({
        id: `task:low_stock:${alert.id}`,
        kind: 'reorder_stock',
        severity: alert.severity,
        label: alert.label,
        value: Math.max(0, DASHBOARD_LOW_STOCK_THRESHOLD - alert.value),
        routeTo: '/products',
      })
    } else if (alert.kind === 'expense_spike') {
      tasks.push({
        id: `task:expense_spike:${alert.id}`,
        kind: 'review_expenses',
        severity: alert.severity,
        label: alert.label,
        value: alert.value,
        routeTo: '/expenses',
      })
    }
  }
  tasks.sort((a, b) => taskScore(b) - taskScore(a))
  return tasks.slice(0, MAX_TASKS)
}

/**
 * Dashboard snapshot over a period with smart alerts and task suggestions.
 */
export function getDashboardSnapshot(
  db: Database,
  input: DashboardSnapshotInput = { range: 'today' },
): IpcResult<DashboardSnapshotDto> {
  return asResult(() => {
    const range = input.range ?? 'today'
    const currentBounds = localPeriodBounds(range, 0)
    const previousBounds = localPeriodBounds(range, 1)
    const { startIso, endIso, startDateYmd, endDateYmd } = currentBounds

    const stSales = db.prepare(
      `SELECT
         COALESCE(SUM(total_lbp), 0) AS t,
         COUNT(*) AS c
       FROM sales
       WHERE voided_at IS NULL AND created_at >= @s AND created_at < @e`,
    )
    const r = stSales.get({ s: startIso, e: endIso }) as { t: number; c: number }
    const rp = stSales.get({
      s: previousBounds.startIso,
      e: previousBounds.endIso,
    }) as { t: number; c: number }

    const stItems = db.prepare(
      `SELECT COALESCE(SUM(sl.quantity), 0) AS n
       FROM sale_lines sl
       INNER JOIN sales s ON s.id = sl.sale_id
       WHERE s.voided_at IS NULL AND s.created_at >= @s AND s.created_at < @e`,
    )
    const n = (stItems.get({ s: startIso, e: endIso }) as { n: number }).n
    const stGrossProfit = db.prepare(
      `SELECT
         COALESCE(SUM(sl.line_total_lbp), 0) AS sales_total,
         COALESCE(SUM(p.base_price_lbp * sl.quantity), 0) AS cost_total
       FROM sale_lines sl
       INNER JOIN sales s ON s.id = sl.sale_id
       INNER JOIN products p ON p.id = sl.product_id
       WHERE s.voided_at IS NULL
         AND s.created_at >= @s
         AND s.created_at < @e`,
    )
    const gp = stGrossProfit.get({ s: startIso, e: endIso }) as { sales_total: number; cost_total: number }
    const grossProfitLbp = gp.sales_total - gp.cost_total
    const grossMarginPct = gp.sales_total > 0 ? (grossProfitLbp / gp.sales_total) * 100 : null

    const stCashIn = db.prepare(
      `SELECT COALESCE(SUM(total_lbp), 0) AS t
       FROM sales
       WHERE voided_at IS NULL
         AND payment_type = 'cash'
         AND created_at >= @s
         AND created_at < @e`,
    )
    const cashInLbp = (stCashIn.get({ s: startIso, e: endIso }) as { t: number }).t

    const stSupplierPay = db.prepare(
      `SELECT COALESCE(SUM(amount_lbp), 0) AS t
       FROM supplier_payments
       WHERE created_at >= @s
         AND created_at < @e`,
    )
    const supplierOutLbp = (stSupplierPay.get({ s: startIso, e: endIso }) as { t: number }).t

    const stCashExpensesPeriod = db.prepare(
      `SELECT COALESCE(SUM(amount_lbp), 0) AS t
       FROM expenses
       WHERE paid_from_cash = 1
         AND date(spent_at) >= date(@from)
         AND date(spent_at) <= date(@to)`,
    )
    const expenseOutLbp = (stCashExpensesPeriod.get({
      from: startDateYmd,
      to: endDateYmd,
    }) as { t: number }).t
    const cashOutLbp = supplierOutLbp + expenseOutLbp

    const stTopCustomerDebt = db.prepare(
      `SELECT
         c.id AS id,
         c.name AS name,
         (
           SELECT COALESCE(SUM(s.total_lbp), 0)
           FROM sales s
           WHERE s.customer_id = c.id AND s.payment_type = 'debt'
         ) - (
           SELECT COALESCE(SUM(p.amount_lbp), 0)
           FROM debt_payments p
           WHERE p.customer_id = c.id
         ) AS balance_lbp
       FROM customers c
       ORDER BY balance_lbp DESC, c.name COLLATE NOCASE
       LIMIT 1`,
    )
    const topCustomer = stTopCustomerDebt.get() as
      | { id: string; name: string; balance_lbp: number }
      | undefined

    const stTopSupplierPayable = db.prepare(
      `SELECT
         s.id AS id,
         s.name AS name,
         (
           SELECT COALESCE(SUM(i.amount_lbp), 0)
           FROM supplier_invoices i
           WHERE i.supplier_id = s.id
         ) - (
           SELECT COALESCE(SUM(p.amount_lbp), 0)
           FROM supplier_payments p
           WHERE p.supplier_id = s.id
         ) AS balance_lbp
       FROM suppliers s
       ORDER BY balance_lbp DESC, s.name COLLATE NOCASE
       LIMIT 1`,
    )
    const topSupplier = stTopSupplierPayable.get() as
      | { id: string; name: string; balance_lbp: number }
      | undefined

    const stAvg7Expenses = db.prepare(
      `SELECT COALESCE(AVG(day_total), 0) AS avg_daily
       FROM (
         SELECT date(spent_at) AS d, SUM(amount_lbp) AS day_total
         FROM expenses
         WHERE paid_from_cash = 1
           AND date(spent_at) >= date(@start)
           AND date(spent_at) < date(@today)
         GROUP BY date(spent_at)
       ) x`,
    )
    const avgDailyExpenseLbp = (stAvg7Expenses.get({
      start: localPeriodBounds('7d', 1).startDateYmd,
      today: startDateYmd,
    }) as { avg_daily: number }).avg_daily

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

    const stTopProducts = db.prepare(
      `SELECT
         p.id AS product_id,
         p.name AS name,
         p.sku AS sku,
         CAST(SUM(sl.quantity) AS INTEGER) AS qty
       FROM sale_lines sl
       INNER JOIN sales s ON s.id = sl.sale_id
       INNER JOIN products p ON p.id = sl.product_id
       WHERE s.voided_at IS NULL
         AND s.created_at >= @s
         AND s.created_at < @e
       GROUP BY p.id, p.name, p.sku
       HAVING qty > 0
       ORDER BY qty DESC, p.name COLLATE NOCASE
       LIMIT 5`,
    )
    const topProducts = stTopProducts.all({ s: startIso, e: endIso }) as {
      product_id: string
      name: string
      sku: string
      qty: number
    }[]

    const stSlowProducts = db.prepare(
      `SELECT
         p.id AS product_id,
         p.name AS name,
         p.sku AS sku,
         CAST(SUM(sl.quantity) AS INTEGER) AS qty
       FROM sale_lines sl
       INNER JOIN sales s ON s.id = sl.sale_id
       INNER JOIN products p ON p.id = sl.product_id
       WHERE s.voided_at IS NULL
         AND s.created_at >= @s
         AND s.created_at < @e
       GROUP BY p.id, p.name, p.sku
       HAVING qty > 0
       ORDER BY qty ASC, p.name COLLATE NOCASE
       LIMIT 5`,
    )
    const slowProducts = stSlowProducts.all({ s: startIso, e: endIso }) as {
      product_id: string
      name: string
      sku: string
      qty: number
    }[]

    const smartAlerts: DashboardSmartAlertDto[] = []

    if (lowRaw.length > 0) {
      const first = lowRaw[0]
      smartAlerts.push({
        id: `low_stock:${first.id}`,
        kind: 'low_stock',
        severity: first.stock === 0 ? 'high' : 'medium',
        label: first.name,
        value: first.stock,
        context: first.sku,
      })
    }
    if (topCustomer && topCustomer.balance_lbp > 0) {
      smartAlerts.push({
        id: `customer_debt:${topCustomer.id}`,
        kind: 'customer_debt',
        severity: topCustomer.balance_lbp >= HIGH_DEBT_BALANCE_LBP ? 'high' : 'medium',
        label: topCustomer.name,
        value: topCustomer.balance_lbp,
        context: null,
      })
    }
    if (topSupplier && topSupplier.balance_lbp > 0) {
      smartAlerts.push({
        id: `supplier_payable:${topSupplier.id}`,
        kind: 'supplier_payable',
        severity: topSupplier.balance_lbp >= HIGH_SUPPLIER_PAYABLE_LBP ? 'high' : 'medium',
        label: topSupplier.name,
        value: topSupplier.balance_lbp,
        context: null,
      })
    }
    if (
      expenseOutLbp >= EXPENSE_SPIKE_MIN_LBP &&
      avgDailyExpenseLbp > 0 &&
      expenseOutLbp >= avgDailyExpenseLbp * EXPENSE_SPIKE_RATIO
    ) {
      smartAlerts.push({
        id: 'expense_spike:period',
        kind: 'expense_spike',
        severity: expenseOutLbp >= avgDailyExpenseLbp * 2 ? 'high' : 'medium',
        label: endDateYmd,
        value: expenseOutLbp - avgDailyExpenseLbp,
        context: null,
      })
    }
    smartAlerts.sort((a, b) => scoreAlert(b) - scoreAlert(a))

    const deltaLbp = r.t - rp.t
    const deltaPct = rp.t > 0 ? (deltaLbp / rp.t) * 100 : null
    const todayTasks = buildTasks(smartAlerts.slice(0, MAX_SMART_ALERTS))

    return {
      period: {
        range,
        startDateYmd,
        endDateYmd,
      },
      today: {
        dateYmd: endDateYmd,
        totalLbp: r.t,
        saleCount: r.c,
        itemsSold: n,
        grossProfitLbp,
        grossMarginPct,
      },
      cashflowToday: {
        cashInLbp,
        cashOutLbp,
        netLbp: cashInLbp - cashOutLbp,
      },
      dayComparison: {
        todayTotalLbp: r.t,
        yesterdayTotalLbp: rp.t,
        deltaLbp,
        deltaPct,
      },
      smartAlerts: smartAlerts.slice(0, MAX_SMART_ALERTS),
      topProducts: topProducts.map((row) => ({
        productId: row.product_id,
        name: row.name,
        sku: row.sku,
        quantitySold: row.qty,
      })),
      slowProducts: slowProducts.map((row) => ({
        productId: row.product_id,
        name: row.name,
        sku: row.sku,
        quantitySold: row.qty,
      })),
      todayTasks,
      alertThresholds: {
        lowStockThreshold: DASHBOARD_LOW_STOCK_THRESHOLD,
        highDebtBalanceLbp: HIGH_DEBT_BALANCE_LBP,
        highSupplierPayableLbp: HIGH_SUPPLIER_PAYABLE_LBP,
        expenseSpikeMinLbp: EXPENSE_SPIKE_MIN_LBP,
        expenseSpikeRatio: EXPENSE_SPIKE_RATIO,
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
