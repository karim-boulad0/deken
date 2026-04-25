import {
  AlertTriangle,
  BarChart3,
  Download,
  Package,
  ScanBarcode,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useToast } from '../../components/toast'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { getDashboardSnapshot } from '../../lib/api/dekenClient'
import { downloadAsCsvFile, fileDateStamp, toCsvLine } from '../../lib/csvExport'
import type { DashboardRange, DashboardSnapshotDto } from '../../../../shared/ipc/types'
import { formatLbp, formatUsd } from '../pos/formatPos'
import './DashboardPage.css'

function formatDayLabel(ymd: string, lng: string): string {
  const d = new Date(`${ymd}T12:00:00`)
  if (Number.isNaN(d.getTime())) {
    return ymd
  }
  return d.toLocaleDateString(lng.startsWith('ar') ? 'ar-LB' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatInt(n: number, lng: string): string {
  return n.toLocaleString(lng.startsWith('ar') ? 'ar-LB' : 'en-US', { maximumFractionDigits: 0 })
}

function formatPct(n: number, lng: string): string {
  return `${n.toLocaleString(lng.startsWith('ar') ? 'ar-LB' : 'en-US', {
    maximumFractionDigits: 1,
  })}%`
}

const rangeOptions: DashboardRange[] = ['today', '7d', '30d']

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { settings } = useAppSettings()
  const lbpPerUsd = settings.lbpPerUsd
  const lng = i18n.language

  const [range, setRange] = useState<DashboardRange>('today')
  const [snap, setSnap] = useState<DashboardSnapshotDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setLoadError(false)
    setLoading(true)
    const r = await getDashboardSnapshot({ range })
    setLoading(false)
    if (r.ok) {
      setSnap(r.data)
    } else {
      setLoadError(true)
      setSnap(null)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  const day = snap?.today.dateYmd
  const today = snap?.today
  const cashflowToday = snap?.cashflowToday
  const comparison = snap?.dayComparison
  const smartAlerts = snap?.smartAlerts ?? []
  const low = snap?.lowStock ?? []
  const lowVisible = low.slice(0, 5)
  const th = snap?.lowStockThreshold ?? 10
  const topProducts = snap?.topProducts ?? []
  const slowProducts = snap?.slowProducts ?? []
  const tasks = snap?.todayTasks ?? []

  function runExportDashboard() {
    if (snap == null) {
      toast.warning(t('common.exportEmpty'))
      return
    }
    const tday = snap.today
    const lines: string[] = []
    const stamp = tday != null ? tday.dateYmd : fileDateStamp()
    lines.push(toCsvLine(['section', 'key', 'value']))
    if (tday) {
      lines.push(toCsvLine(['today', 'dateYmd', tday.dateYmd]))
      lines.push(toCsvLine(['today', 'totalLbp', tday.totalLbp]))
      lines.push(toCsvLine(['today', 'approxUsd', tday.totalLbp / lbpPerUsd]))
      lines.push(toCsvLine(['today', 'saleCount', tday.saleCount]))
      lines.push(toCsvLine(['today', 'itemsSold', tday.itemsSold]))
    }
    if (snap.cashflowToday) {
      lines.push(toCsvLine(['cashflow', 'cashInLbp', snap.cashflowToday.cashInLbp]))
      lines.push(toCsvLine(['cashflow', 'cashOutLbp', snap.cashflowToday.cashOutLbp]))
      lines.push(toCsvLine(['cashflow', 'netLbp', snap.cashflowToday.netLbp]))
    }
    if (snap.dayComparison) {
      lines.push(toCsvLine(['comparison', 'periodTotalLbp', snap.dayComparison.todayTotalLbp]))
      lines.push(toCsvLine(['comparison', 'previousTotalLbp', snap.dayComparison.yesterdayTotalLbp]))
      lines.push(toCsvLine(['comparison', 'deltaLbp', snap.dayComparison.deltaLbp]))
      lines.push(toCsvLine(['comparison', 'deltaPct', snap.dayComparison.deltaPct ?? '']))
    }
    if (smartAlerts.length > 0) {
      lines.push('')
      lines.push(toCsvLine(['smart_alert_kind', 'severity', 'label', 'value']))
      for (const a of smartAlerts) {
        lines.push(toCsvLine([a.kind, a.severity, a.label, a.value]))
      }
    }
    if (topProducts.length > 0) {
      lines.push('')
      lines.push(toCsvLine(['top_products_name', 'sku', 'quantity_sold']))
      for (const p of topProducts) {
        lines.push(toCsvLine([p.name, p.sku, p.quantitySold]))
      }
    }
    if (tasks.length > 0) {
      lines.push('')
      lines.push(toCsvLine(['tasks_kind', 'severity', 'label', 'value', 'route']))
      for (const task of tasks) {
        lines.push(toCsvLine([task.kind, task.severity, task.label, task.value, task.routeTo]))
      }
    }
    lines.push('')
    lines.push(toCsvLine([`lowStock_threshold: ${th}`]))
    lines.push(
      toCsvLine([
        t('dashboard.alerts.colName'),
        t('dashboard.alerts.colSku'),
        t('dashboard.alerts.colStock'),
      ]),
    )
    for (const r of low) {
      lines.push(toCsvLine([r.name, r.sku, r.stock]))
    }
    downloadAsCsvFile(`deken-dashboard-${stamp}`, lines)
    toast.success(t('common.exportToast'))
  }

  function alertTitle(alert: DashboardSnapshotDto['smartAlerts'][number]): string {
    if (alert.kind === 'low_stock') return t('dashboard.smartAlerts.lowStockTitle', { name: alert.label })
    if (alert.kind === 'customer_debt') return t('dashboard.smartAlerts.customerDebtTitle', { name: alert.label })
    if (alert.kind === 'supplier_payable') return t('dashboard.smartAlerts.supplierPayableTitle', { name: alert.label })
    return t('dashboard.smartAlerts.expenseSpikeTitle')
  }

  function alertValue(alert: DashboardSnapshotDto['smartAlerts'][number]): string {
    if (alert.kind === 'low_stock') return t('dashboard.smartAlerts.lowStockValue', { n: formatInt(alert.value, lng) })
    return formatLbp(alert.value, lng)
  }

  function alertHint(alert: DashboardSnapshotDto['smartAlerts'][number]): string {
    if (snap == null) return ''
    if (alert.kind === 'low_stock') {
      return t('dashboard.smartAlerts.lowStockHint', { threshold: snap.alertThresholds.lowStockThreshold })
    }
    if (alert.kind === 'customer_debt') {
      return t('dashboard.smartAlerts.customerDebtHint', {
        threshold: formatLbp(snap.alertThresholds.highDebtBalanceLbp, lng),
      })
    }
    if (alert.kind === 'supplier_payable') {
      return t('dashboard.smartAlerts.supplierPayableHint', {
        threshold: formatLbp(snap.alertThresholds.highSupplierPayableLbp, lng),
      })
    }
    return t('dashboard.smartAlerts.expenseSpikeHint', {
      min: formatLbp(snap.alertThresholds.expenseSpikeMinLbp, lng),
      ratio: formatPct(snap.alertThresholds.expenseSpikeRatio * 100, lng),
    })
  }

  function taskTitle(task: DashboardSnapshotDto['todayTasks'][number]): string {
    if (task.kind === 'collect_customer_debt') return t('dashboard.tasks.collectDebt', { name: task.label })
    if (task.kind === 'pay_supplier') return t('dashboard.tasks.paySupplier', { name: task.label })
    if (task.kind === 'reorder_stock') return t('dashboard.tasks.reorderStock', { name: task.label })
    return t('dashboard.tasks.reviewExpenses')
  }

  return (
    <div className="dash dash--fill">
      <header className="dash__header">
        <div className="dash__header-top">
          <div className="dash__header-text">
            <h1 className="dash__title" id="dash-page-title">
              {t('dashboard.pageTitle')}
            </h1>
            <p className="dash__intro">{t('dashboard.intro')}</p>
            {day ? (
              <p className="dash__date">
                {t('dashboard.dateLine', {
                  date: formatDayLabel(day, lng),
                  from: formatDayLabel(snap?.period.startDateYmd ?? day, lng),
                  to: formatDayLabel(snap?.period.endDateYmd ?? day, lng),
                })}
              </p>
            ) : null}
          </div>
          <div className="dash__header-actions">
            <div className="dash-range" role="group" aria-label={t('dashboard.range.aria')}>
              {rangeOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={opt === range ? 'dash-range__btn dash-range__btn--active' : 'dash-range__btn'}
                  onClick={() => setRange(opt)}
                  disabled={loading}
                >
                  {t(`dashboard.range.${opt}`)}
                </button>
              ))}
            </div>
            {!loadError && snap != null && !loading ? (
              <button
                type="button"
                className="dash-btn dash-btn--export"
                onClick={runExportDashboard}
                title={t('common.exportAria')}
                aria-label={t('common.exportAria')}
              >
                <Download size={18} strokeWidth={2} aria-hidden />
                {t('common.export')}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="dash__grid">
        <section className="dash-card" aria-labelledby="dash-summary-title">
          <h2 className="dash-card__title" id="dash-summary-title">
            {t('dashboard.sections.summary')}
          </h2>
          {loadError ? (
            <div className="dash-panel-msg" role="alert">
              <p className="dash-panel-msg__text">{t('dashboard.loadError')}</p>
              <button type="button" className="dash-btn" onClick={() => void load()}>
                {t('dashboard.retry')}
              </button>
            </div>
          ) : (
            <ul className="dash-statlist dash-statlist--summary">
              <li className="dash-statlist__row">
                <span className="dash-statlist__label">{t('dashboard.summary.salesLabel')}</span>
                <div className="dash-statlist__valuecol">
                  <span
                    className="dash-statlist__value"
                    aria-label={
                      today && !loading
                        ? t('dashboard.summary.salesAria', {
                            lbp: formatLbp(today.totalLbp, lng),
                            usd: formatUsd(today.totalLbp / lbpPerUsd, lng),
                          })
                        : undefined
                    }
                  >
                    {loading || !today ? t('dashboard.summary.loading') : formatUsd(today.totalLbp / lbpPerUsd, lng)}
                  </span>
                  {today && !loading ? (
                    <span className="dash-statlist__sublbp">{formatLbp(today.totalLbp, lng)}</span>
                  ) : null}
                </div>
              </li>
              <li className="dash-statlist__row">
                <span className="dash-statlist__label">{t('dashboard.summary.invoicesLabel')}</span>
                <span className="dash-statlist__value">
                  {loading || !today ? t('dashboard.summary.loading') : formatInt(today.saleCount, lng)}
                </span>
              </li>
              <li className="dash-statlist__row">
                <span className="dash-statlist__label">{t('dashboard.summary.itemsLabel')}</span>
                <span className="dash-statlist__value">
                  {loading || !today ? t('dashboard.summary.loading') : formatInt(today.itemsSold, lng)}
                </span>
              </li>
            </ul>
          )}

          {!loadError && !loading && cashflowToday ? (
            <div className="dash-cashflow" aria-label={t('dashboard.cashflow.title')}>
              <h3 className="dash-cashflow__title">{t('dashboard.cashflow.title')}</h3>
              <div className="dash-cashflow__grid">
                <div className="dash-kpi dash-kpi--in">
                  <span className="dash-kpi__label">{t('dashboard.cashflow.cashIn')}</span>
                  <span className="dash-kpi__value">{formatLbp(cashflowToday.cashInLbp, lng)}</span>
                </div>
                <div className="dash-kpi dash-kpi--out">
                  <span className="dash-kpi__label">{t('dashboard.cashflow.cashOut')}</span>
                  <span className="dash-kpi__value">{formatLbp(cashflowToday.cashOutLbp, lng)}</span>
                </div>
                <div className="dash-kpi">
                  <span className="dash-kpi__label">{t('dashboard.cashflow.net')}</span>
                  <span className={cashflowToday.netLbp >= 0 ? 'dash-kpi__value dash-kpi__value--good' : 'dash-kpi__value dash-kpi__value--bad'}>
                    {formatLbp(cashflowToday.netLbp, lng)}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {!loadError && !loading && comparison ? (
            <div className="dash-compare" aria-label={t('dashboard.compare.title')}>
              <div className="dash-compare__head">
                <h3 className="dash-compare__title">{t('dashboard.compare.title')}</h3>
                <span className={comparison.deltaLbp >= 0 ? 'dash-compare__pill dash-compare__pill--up' : 'dash-compare__pill dash-compare__pill--down'}>
                  {comparison.deltaLbp >= 0 ? <TrendingUp size={14} strokeWidth={2} aria-hidden /> : <TrendingDown size={14} strokeWidth={2} aria-hidden />}
                  {comparison.deltaPct == null
                    ? t('dashboard.compare.noBaseline')
                    : t('dashboard.compare.deltaPct', {
                        n: formatPct(Math.abs(comparison.deltaPct), lng),
                      })}
                </span>
              </div>
              <p className="dash-compare__line">
                {t('dashboard.compare.line', {
                  today: formatLbp(comparison.todayTotalLbp, lng),
                  yesterday: formatLbp(comparison.yesterdayTotalLbp, lng),
                  delta: formatLbp(comparison.deltaLbp, lng),
                })}
              </p>
            </div>
          ) : null}

          {!loadError && !loading ? (
            <div className="dash-smart">
              <h3 className="dash-smart__title">{t('dashboard.smartAlerts.title')}</h3>
              {smartAlerts.length === 0 ? (
                <p className="dash-smart__empty">{t('dashboard.smartAlerts.empty')}</p>
              ) : (
                <ul className="dash-smart__list">
                  {smartAlerts.map((a) => (
                    <li key={a.id} className="dash-smart__item">
                      <span className={a.severity === 'high' ? 'dash-smart__sev dash-smart__sev--high' : 'dash-smart__sev'}>
                        <AlertTriangle size={14} strokeWidth={2} aria-hidden />
                        {a.severity === 'high' ? t('dashboard.smartAlerts.severityHigh') : t('dashboard.smartAlerts.severityMedium')}
                      </span>
                      <div className="dash-smart__text">
                        <span className="dash-smart__label">{alertTitle(a)}</span>
                        <span className="dash-smart__value">{alertValue(a)}</span>
                        <span className="dash-smart__hint">{alertHint(a)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <p className="dash-card__footnote">{t('dashboard.summary.footnote')}</p>
        </section>

        <section className="dash-card" aria-labelledby="dash-shortcuts-title">
          <h2 className="dash-card__title" id="dash-shortcuts-title">
            {t('dashboard.sections.shortcuts')}
          </h2>
          <ul className="dash-shortcuts">
            <li>
              <Link className="dash-shortcuts__link" to="/pos">
                <span className="dash-shortcuts__icon" aria-hidden>
                  <ScanBarcode size={20} strokeWidth={2} />
                </span>
                <span className="dash-shortcuts__text">
                  <span className="dash-shortcuts__name">{t('dashboard.shortcuts.newSale')}</span>
                  <span className="dash-shortcuts__desc">{t('dashboard.shortcuts.newSaleDesc')}</span>
                </span>
              </Link>
            </li>
            <li>
              <Link className="dash-shortcuts__link" to="/products">
                <span className="dash-shortcuts__icon" aria-hidden>
                  <Package size={20} strokeWidth={2} />
                </span>
                <span className="dash-shortcuts__text">
                  <span className="dash-shortcuts__name">{t('dashboard.shortcuts.products')}</span>
                  <span className="dash-shortcuts__desc">{t('dashboard.shortcuts.productsDesc')}</span>
                </span>
              </Link>
            </li>
            <li>
              <Link className="dash-shortcuts__link" to="/debts">
                <span className="dash-shortcuts__icon" aria-hidden>
                  <Wallet size={20} strokeWidth={2} />
                </span>
                <span className="dash-shortcuts__text">
                  <span className="dash-shortcuts__name">{t('dashboard.shortcuts.debts')}</span>
                  <span className="dash-shortcuts__desc">{t('dashboard.shortcuts.debtsDesc')}</span>
                </span>
              </Link>
            </li>
            <li>
              <Link className="dash-shortcuts__link" to="/reports">
                <span className="dash-shortcuts__icon" aria-hidden>
                  <BarChart3 size={20} strokeWidth={2} />
                </span>
                <span className="dash-shortcuts__text">
                  <span className="dash-shortcuts__name">{t('dashboard.shortcuts.reports')}</span>
                  <span className="dash-shortcuts__desc">{t('dashboard.shortcuts.reportsDesc')}</span>
                </span>
              </Link>
            </li>
          </ul>
        </section>

        <section className="dash-card" aria-labelledby="dash-products-title">
          <h2 className="dash-card__title" id="dash-products-title">
            {t('dashboard.sections.topProducts')}
          </h2>
          {loadError ? (
            <p className="dash-panel-msg__text">{t('dashboard.loadError')}</p>
          ) : loading ? (
            <p className="dash-alerts__loading">{t('dashboard.summary.loading')}</p>
          ) : (
            <div className="dash-movers">
              <div>
                <h3 className="dash-movers__title">{t('dashboard.topProducts.bestTitle')}</h3>
                {topProducts.length === 0 ? (
                  <p className="dash-movers__empty">{t('dashboard.topProducts.empty')}</p>
                ) : (
                  <ul className="dash-movers__list">
                    {topProducts.map((p) => (
                      <li key={`top-${p.productId}`} className="dash-movers__item">
                        <span className="dash-movers__name">{p.name}</span>
                        <span className="dash-movers__meta">{p.sku}</span>
                        <span className="dash-movers__qty">{t('dashboard.topProducts.qty', { n: formatInt(p.quantitySold, lng) })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="dash-movers__title">{t('dashboard.topProducts.slowTitle')}</h3>
                {slowProducts.length === 0 ? (
                  <p className="dash-movers__empty">{t('dashboard.topProducts.empty')}</p>
                ) : (
                  <ul className="dash-movers__list">
                    {slowProducts.map((p) => (
                      <li key={`slow-${p.productId}`} className="dash-movers__item">
                        <span className="dash-movers__name">{p.name}</span>
                        <span className="dash-movers__meta">{p.sku}</span>
                        <span className="dash-movers__qty">{t('dashboard.topProducts.qty', { n: formatInt(p.quantitySold, lng) })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="dash-movers__links">
                <Link to="/products">{t('dashboard.topProducts.openProducts')}</Link>
                <Link to="/reports">{t('dashboard.topProducts.openReports')}</Link>
              </div>
            </div>
          )}
        </section>

        <section className="dash-card" aria-labelledby="dash-tasks-title">
          <h2 className="dash-card__title" id="dash-tasks-title">
            {t('dashboard.sections.tasks')}
          </h2>
          {loadError ? (
            <p className="dash-panel-msg__text">{t('dashboard.loadError')}</p>
          ) : loading ? (
            <p className="dash-alerts__loading">{t('dashboard.summary.loading')}</p>
          ) : tasks.length === 0 ? (
            <p className="dash-smart__empty">{t('dashboard.tasks.empty')}</p>
          ) : (
            <ul className="dash-tasks">
              {tasks.map((task) => (
                <li key={task.id} className="dash-tasks__row">
                  <div className="dash-tasks__text">
                    <span className="dash-tasks__label">{taskTitle(task)}</span>
                    <span className="dash-tasks__value">
                      {task.kind === 'reorder_stock' ? formatInt(task.value, lng) : formatLbp(task.value, lng)}
                    </span>
                  </div>
                  <Link className="dash-tasks__go" to={task.routeTo}>
                    {t('dashboard.tasks.open')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-card dash-card--wide dash-card--alerts" aria-labelledby="dash-alerts-title">
          <h2 className="dash-card__title" id="dash-alerts-title">
            {t('dashboard.sections.alerts')}
          </h2>
          {loadError ? (
            <div className="dash-panel-msg" role="alert">
              <p className="dash-panel-msg__text">{t('dashboard.loadError')}</p>
              <button type="button" className="dash-btn" onClick={() => void load()}>
                {t('dashboard.retry')}
              </button>
            </div>
          ) : loading ? (
            <p className="dash-alerts__loading">{t('dashboard.summary.loading')}</p>
          ) : low.length === 0 ? (
            <div className="dash-empty" role="status">
              <p className="dash-empty__title">{t('dashboard.alerts.emptyTitle')}</p>
              <p className="dash-empty__text">{t('dashboard.alerts.emptyBody', { threshold: th })}</p>
            </div>
          ) : (
            <div className="dash-alerts">
              <div className="dash-alerts__head">
                <p className="dash-alerts__hint">{t('dashboard.alerts.tableHint', { threshold: th })}</p>
                {low.length > lowVisible.length ? (
                  <Link className="dash-alerts__viewall" to="/products">
                    {t('dashboard.alerts.viewAll')}
                  </Link>
                ) : null}
              </div>
              <div className="dash-alerts__wrap">
                <table className="dash-alerts-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('dashboard.alerts.colName')}</th>
                      <th scope="col">{t('dashboard.alerts.colSku')}</th>
                      <th scope="col" className="dash-alerts-table__num">
                        {t('dashboard.alerts.colStock')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowVisible.map((row) => {
                      const out = row.stock === 0
                      return (
                        <tr key={row.id}>
                          <td className="dash-alerts-table__strong">{row.name}</td>
                          <td className="dash-alerts-table__muted">{row.sku}</td>
                          <td className="dash-alerts-table__num">
                            <span className={out ? 'dash-alerts__badge dash-alerts__badge--out' : 'dash-alerts__badge'}>
                              {out ? t('dashboard.alerts.badgeOut') : t('dashboard.alerts.badgeLow', { n: formatInt(row.stock, lng) })}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
