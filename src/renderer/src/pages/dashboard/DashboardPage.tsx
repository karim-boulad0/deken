import { BarChart3, Download, Package, ScanBarcode, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useToast } from '../../components/toast'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { getDashboardSnapshot } from '../../lib/api/dekenClient'
import { downloadAsCsvFile, fileDateStamp, toCsvLine } from '../../lib/csvExport'
import type { DashboardSnapshotDto } from '../../../../shared/ipc/types'
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

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { settings } = useAppSettings()
  const lbpPerUsd = settings.lbpPerUsd
  const lng = i18n.language

  const [snap, setSnap] = useState<DashboardSnapshotDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setLoadError(false)
    setLoading(true)
    const r = await getDashboardSnapshot()
    setLoading(false)
    if (r.ok) {
      setSnap(r.data)
    } else {
      setLoadError(true)
      setSnap(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const day = snap?.today.dateYmd
  const today = snap?.today
  const low = snap?.lowStock ?? []
  const th = snap?.lowStockThreshold ?? 10

  function runExportDashboard() {
    if (snap == null) {
      toast.warning(t('common.exportEmpty'))
      return
    }
    const tday = snap.today
    const lines: string[] = []
    const stamp = tday != null ? tday.dateYmd : fileDateStamp()
    lines.push(
      toCsvLine([
        'section',
        'key',
        'value',
      ]),
    )
    if (tday) {
      lines.push(toCsvLine(['today', 'dateYmd', tday.dateYmd]))
      lines.push(toCsvLine(['today', 'totalLbp', tday.totalLbp]))
      lines.push(
        toCsvLine([
          'today',
          'approxUsd',
          tday.totalLbp / lbpPerUsd,
        ]),
      )
      lines.push(toCsvLine(['today', 'saleCount', tday.saleCount]))
      lines.push(toCsvLine(['today', 'itemsSold', tday.itemsSold]))
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
                {t('dashboard.dateLine', { date: formatDayLabel(day, lng) })}
              </p>
            ) : null}
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
                    {loading || !today
                      ? t('dashboard.summary.loading')
                      : formatUsd(today.totalLbp / lbpPerUsd, lng)}
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
                  <span className="dash-shortcuts__desc">
                    {t('dashboard.shortcuts.newSaleDesc')}
                  </span>
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
                  <span className="dash-shortcuts__desc">
                    {t('dashboard.shortcuts.productsDesc')}
                  </span>
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
                  <span className="dash-shortcuts__desc">
                    {t('dashboard.shortcuts.debtsDesc')}
                  </span>
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
                  <span className="dash-shortcuts__desc">
                    {t('dashboard.shortcuts.reportsDesc')}
                  </span>
                </span>
              </Link>
            </li>
          </ul>
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
              <p className="dash-empty__text">
                {t('dashboard.alerts.emptyBody', { threshold: th })}
              </p>
            </div>
          ) : (
            <div className="dash-alerts">
              <p className="dash-alerts__hint">{t('dashboard.alerts.tableHint', { threshold: th })}</p>
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
                    {low.map((row) => {
                      const out = row.stock === 0
                      return (
                        <tr key={row.id}>
                          <td className="dash-alerts-table__strong">{row.name}</td>
                          <td className="dash-alerts-table__muted">{row.sku}</td>
                          <td className="dash-alerts-table__num">
                            <span
                              className={
                                out ? 'dash-alerts__badge dash-alerts__badge--out' : 'dash-alerts__badge'
                              }
                            >
                              {out
                                ? t('dashboard.alerts.badgeOut')
                                : t('dashboard.alerts.badgeLow', { n: formatInt(row.stock, lng) })}
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
