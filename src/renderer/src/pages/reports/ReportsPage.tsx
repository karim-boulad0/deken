import { Download } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/toast'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { getSalesReport } from '../../lib/api/dekenClient'
import { downloadAsCsvFile, toCsvLine } from '../../lib/csvExport'
import {
  mergeByDayToFullRange,
  rangeForPreset,
  type PeriodPreset,
} from '../../lib/reportDateRange'
import { formatLbp, formatUsd } from '../pos/formatPos'
import type { SalesReportDto } from '../../../../shared/ipc/types'
import './ReportsPage.css'

export function ReportsPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { settings } = useAppSettings()
  const lbpPerUsd = settings.lbpPerUsd
  const lng = i18n.language
  const periodLabelId = useId()
  const [preset, setPreset] = useState<PeriodPreset>('week')
  const [fromDate, setFromDate] = useState(() => rangeForPreset('week').fromDate)
  const [toDate, setToDate] = useState(() => rangeForPreset('week').toDate)
  const [report, setReport] = useState<SalesReportDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(
    async (from: string, to: string) => {
      setLoadError(false)
      setLoading(true)
      const r = await getSalesReport({ fromDate: from, toDate: to })
      setLoading(false)
      if (r.ok) {
        setReport(r.data)
      } else {
        setLoadError(true)
        setReport(null)
      }
    },
    [],
  )

  useEffect(() => {
    const { fromDate: f, toDate: t } = rangeForPreset('week')
    void load(f, t)
  }, [load])

  function onPresetChange(p: PeriodPreset) {
    setPreset(p)
    const r = rangeForPreset(p)
    setFromDate(r.fromDate)
    setToDate(r.toDate)
    void load(r.fromDate, r.toDate)
  }

  function onApply() {
    void load(fromDate, toDate)
  }

  const loc = lng.startsWith('ar') ? 'ar-LB' : 'en-US'

  const chartByDay = useMemo(() => {
    if (!report) {
      return []
    }
    return mergeByDayToFullRange(report.fromDate, report.toDate, report.byDay)
  }, [report])

  const maxBarLbp = useMemo(() => {
    if (chartByDay.length === 0) {
      return 1
    }
    return Math.max(1, ...chartByDay.map((d) => d.totalLbp))
  }, [chartByDay])

  /**
   * Y-axis: unique values from high → low (top → bottom of bar track), aligned with
   * bar height % = `totalLbp / maxBarLbp`.
   */
  const yAxisTickValues = useMemo(() => {
    const m = maxBarLbp
    if (m <= 0) {
      return [0]
    }
    const slots = 5
    const asc = Array.from({ length: slots }, (_, i) => Math.round((i * m) / (slots - 1)))
    return [...new Set(asc)].sort((a, b) => b - a)
  }, [maxBarLbp])

  function formatAxisTickLbp(n: number): string {
    const abs = Math.abs(n)
    if (abs >= 1_000_000) {
      return (n / 1_000_000).toFixed(1) + 'M'
    }
    if (abs >= 10_000) {
      return (n / 1_000).toFixed(1) + 'k'
    }
    return n.toLocaleString(loc, { maximumFractionDigits: 0, useGrouping: true })
  }

  const chartHasMultipleMonths = useMemo(() => {
    if (!report) {
      return false
    }
    return report.fromDate.slice(0, 7) !== report.toDate.slice(0, 7)
  }, [report])

  function runExportReport() {
    if (report == null) {
      return
    }
    const lines: string[] = []
    lines.push(toCsvLine([t('reports.filters.fromLabel'), report.fromDate]))
    lines.push(toCsvLine([t('reports.filters.toLabel'), report.toDate]))
    lines.push('')
    lines.push(toCsvLine([t('reports.summary.totalLbp'), report.totalLbp]))
    lines.push(toCsvLine([t('reports.summary.netProfitLbp'), report.grossProfitLbp]))
    lines.push(toCsvLine([t('reports.summary.cashLbp'), report.totalCashLbp]))
    lines.push(toCsvLine([t('reports.summary.debtLbp'), report.totalDebtLbp]))
    lines.push(toCsvLine([t('reports.summary.saleCount'), report.saleCount]))
    lines.push('')
    lines.push(
      toCsvLine([
        'day', // YYYY-MM-DD
        t('reports.table.colInvoices'),
        'total_lbp',
        'net_profit_lbp'
      ]),
    )
    for (const d of chartByDay) {
      lines.push(toCsvLine([d.day, d.count, d.totalLbp, d.grossProfitLbp]))
    }
    const fname = `deken-report-${report.fromDate}_to_${report.toDate}`.replace(/[:/\\?*[\]]/g, '_')
    downloadAsCsvFile(fname, lines)
    toast.success(t('common.exportToast'))
  }

  return (
    <div className="rep">
      <header className="rep__header">
        <h1 className="rep__title" id="rep-page-title">
          {t('reports.pageTitle')}
        </h1>
        <p className="rep__intro">{t('reports.intro')}</p>
      </header>

      <section className="rep-toolbar" aria-labelledby={periodLabelId}>
        <div className="rep-toolbar__row">
          <label className="rep-field">
            <span className="rep-field__label" id={periodLabelId}>
              {t('reports.filters.periodLabel')}
            </span>
            <select
              className="rep-field__select"
              value={preset}
              onChange={(e) => onPresetChange(e.target.value as PeriodPreset)}
              aria-label={t('reports.filters.periodLabel')}
            >
              <option value="week">{t('reports.filters.presetWeek')}</option>
              <option value="month">{t('reports.filters.presetMonth')}</option>
              <option value="quarter">{t('reports.filters.presetQuarter')}</option>
            </select>
          </label>
          <div className="rep-toolbar__dates">
            <label className="rep-field rep-field--inline">
              <span className="rep-field__label">{t('reports.filters.fromLabel')}</span>
              <input
                className="rep-field__input"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label={t('reports.filters.fromLabel')}
              />
            </label>
            <label className="rep-field rep-field--inline">
              <span className="rep-field__label">{t('reports.filters.toLabel')}</span>
              <input
                className="rep-field__input"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                aria-label={t('reports.filters.toLabel')}
              />
            </label>
          </div>
          <button
            type="button"
            className="rep-btn rep-btn--primary"
            onClick={onApply}
            disabled={loading}
          >
            {t('reports.filters.apply')}
          </button>
          <button
            type="button"
            className="rep-btn rep-btn--ghost"
            onClick={runExportReport}
            disabled={loading || loadError || report == null}
            title={t('common.exportAria')}
            aria-label={t('common.exportAria')}
          >
            <Download size={16} strokeWidth={2} aria-hidden />
            {t('common.export')}
          </button>
        </div>
      </section>

      {loadError ? (
        <div className="rep-error" role="status">
          <p>{t('reports.loadError')}</p>
          <button
            type="button"
            className="rep-btn rep-btn--primary"
            onClick={() => void load(fromDate, toDate)}
          >
            {t('reports.retryLoad')}
          </button>
        </div>
      ) : null}

      {report && !loadError ? (
        <div className="rep-summary" role="group" aria-label={t('reports.summary.aria')}>
          <div className="rep-summary__card">
            <span className="rep-summary__label">{t('reports.summary.totalLbp')}</span>
            <span className="rep-summary__value">{formatLbp(report.totalLbp, lng)}</span>
          </div>
          <div className="rep-summary__card">
            <span className="rep-summary__label">{t('reports.summary.netProfitLbp')}</span>
            <span className="rep-summary__value">{formatLbp(report.grossProfitLbp, lng)}</span>
          </div>
          <div className="rep-summary__card">
            <span className="rep-summary__label">{t('reports.summary.cashLbp')}</span>
            <span className="rep-summary__value">{formatLbp(report.totalCashLbp, lng)}</span>
          </div>
          <div className="rep-summary__card">
            <span className="rep-summary__label">{t('reports.summary.debtLbp')}</span>
            <span className="rep-summary__value">{formatLbp(report.totalDebtLbp, lng)}</span>
          </div>
          <div className="rep-summary__card">
            <span className="rep-summary__label">{t('reports.summary.saleCount')}</span>
            <span className="rep-summary__value">
              {report.saleCount.toLocaleString(loc)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="rep__grid">
        {report && !loadError && report.saleCount === 0 && !loading ? (
          <section className="rep-empty" aria-labelledby="rep-empty-title">
            <h2 className="rep-empty__title" id="rep-empty-title">
              {t('reports.empty.title')}
            </h2>
            <p className="rep-empty__body">{t('reports.empty.body')}</p>
          </section>
        ) : null}

        {report && !loadError && report.saleCount > 0 ? (
          <section className="rep-preview" aria-labelledby="rep-chart-title">
            <h2 className="rep-preview__title" id="rep-chart-title">
              {t('reports.chart.title')}
            </h2>
            <p className="rep-preview__hint">
              {t('reports.chart.hint', { usd: formatUsd(report.totalLbp / lbpPerUsd, lng) })}
            </p>
            <p className="rep-chart__y-caption">{t('reports.chart.yCaption')}</p>
            <div
              className="rep-chart"
              role="img"
              aria-label={t('reports.chart.aria', { n: String(chartByDay.length) })}
            >
              <div className="rep-chart__plot" dir="ltr" lang={lng}>
                <div className="rep-chart__y-col" aria-hidden>
                  <div className="rep-chart__y-head" />
                  <div className="rep-chart__y-ticks">
                    {yAxisTickValues.map((tick, i) => (
                      <div key={`y-${i}-${tick}`} className="rep-chart__y-tick">
                        {formatAxisTickLbp(tick)}
                      </div>
                    ))}
                  </div>
                  <div className="rep-chart__y-foot" />
                </div>
                <div className="rep-chart__scroller">
                  <div
                    className="rep-chart__grid"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(1, chartByDay.length)}, minmax(0, 1fr))`,
                      minWidth: `max(100%, ${(Math.max(1, chartByDay.length) * 4).toFixed(2)}rem)`,
                    }}
                  >
                    {chartByDay.map((d) => {
                      const pct = maxBarLbp > 0 ? (d.totalLbp / maxBarLbp) * 100 : 0
                      const tDay = new Date(d.day + 'T12:00:00')
                      return (
                        <div key={d.day} className="rep-chart__col">
                          <div
                            className={
                              d.totalLbp > 0
                                ? 'rep-chart__value'
                                : 'rep-chart__value rep-chart__value--empty'
                            }
                            title={`${d.day} · ${formatLbp(d.totalLbp, lng)} · ${
                              d.count
                            } ${t('reports.table.colInvoices')}`}
                          >
                            {d.totalLbp > 0
                              ? formatLbp(d.totalLbp, lng)
                              : t('reports.chart.barEmptyValue')}
                          </div>
                          <div
                            className="rep-chart__bartrack"
                            title={`${d.day} · ${formatLbp(d.totalLbp, lng)} · ${
                              d.count
                            } ${t('reports.table.colInvoices')}`}
                          >
                            <div
                              className={
                                d.totalLbp > 0
                                  ? 'rep-chart__fill'
                                  : 'rep-chart__fill rep-chart__fill--empty'
                              }
                              style={{ height: `${d.totalLbp > 0 ? Math.max(2, pct) : 0}%` }}
                              aria-hidden
                            />
                          </div>
                          <div className="rep-chart__x">
                            <span className="rep-chart__x-day">
                              {tDay.toLocaleDateString(loc, { weekday: 'short' })}
                            </span>
                            {chartHasMultipleMonths ? (
                              <span className="rep-chart__x-sub">
                                {tDay.toLocaleDateString(loc, { month: 'short', day: 'numeric' })}
                              </span>
                            ) : (
                              <span className="rep-chart__x-sub">{tDay.getDate()}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {report && !loadError && report.saleCount > 0 ? (
          <section className="rep-table-wrap" aria-labelledby="rep-table-title">
            <h2 className="rep-preview__title" id="rep-table-title">
              {t('reports.table.sectionTitle')}
            </h2>
            <div className="rep-table-mock">
              <table className="rep-table">
                <thead>
                  <tr>
                    <th scope="col">{t('reports.table.colDay')}</th>
                    <th scope="col" className="rep-table__num">
                      {t('reports.table.colInvoices')}
                    </th>
                    <th scope="col" className="rep-table__num">
                      {t('reports.table.colSales')}
                    </th>
                    <th scope="col" className="rep-table__num">
                      {t('reports.table.colProfit')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.byDay
                    .filter((d) => d.count > 0)
                    .map((d) => {
                      const day = new Date(d.day + 'T12:00:00')
                      return (
                        <tr key={d.day}>
                          <td>
                            {day.toLocaleDateString(loc, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="rep-table__num">
                            {d.count.toLocaleString(loc)}
                          </td>
                          <td className="rep-table__num rep-table__strong">
                            {formatLbp(d.totalLbp, lng)}
                          </td>
                          <td className="rep-table__num rep-table__strong">
                            {formatLbp(d.grossProfitLbp, lng)}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {loading && !loadError ? (
          <p className="rep-loading" aria-live="polite">
            {t('reports.loading')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
