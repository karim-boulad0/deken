import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { getSalesReport } from '../../lib/api/dekenClient'
import { rangeForPreset, type PeriodPreset } from '../../lib/reportDateRange'
import { formatLbp, formatUsd } from '../pos/formatPos'
import type { SalesReportDto } from '../../../../shared/ipc/types'
import './ReportsPage.css'

export function ReportsPage() {
  const { t, i18n } = useTranslation()
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

  const maxBar = useMemo(() => {
    if (!report?.byDay.length) {
      return 1
    }
    return Math.max(1, ...report.byDay.map((d) => d.totalLbp))
  }, [report])

  const loc = lng.startsWith('ar') ? 'ar-LB' : 'en-US'

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
            <div
              className="rep-chart"
              role="img"
              aria-label={t('reports.chart.aria', { n: String(report.byDay.length) })}
            >
              <div className="rep-chart__bars">
                {report.byDay.map((d) => (
                  <div
                    key={d.day}
                    className="rep-chart__bar"
                    style={{
                      height: `${Math.max(4, (d.totalLbp / maxBar) * 100)}%`,
                      opacity: d.totalLbp > 0 ? 0.85 : 0.2,
                    }}
                    title={`${d.day}: ${formatLbp(d.totalLbp, lng)} (${d.count})`}
                  />
                ))}
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
