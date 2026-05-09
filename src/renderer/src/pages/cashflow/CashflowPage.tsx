import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/toast'
import { listRecentCashflow, voidCashSale } from '../../lib/api/dekenClient'
import { formatLbp } from '../pos/formatPos'
import type { CashflowLineDto } from '../../../../shared/ipc/types'
import './CashflowPage.css'

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mapVoidErr(m: string): string {
  const s = m.trim()
  if (
    s === 'sale_not_found' ||
    s === 'not_cash_sale' ||
    s === 'already_voided' ||
    s === 'void_not_same_day' ||
    s === 'invalid_input'
  ) {
    return s
  }
  return 'generic'
}

export function CashflowPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const lng = i18n.language
  const loc = lng.startsWith('ar') ? 'ar-LB' : 'en-US'
  const [fromDate, setFromDate] = useState(() => todayYmd())
  const [toDate, setToDate] = useState(() => todayYmd())
  const [limit, setLimit] = useState(1)
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<CashflowLineDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [voidTarget, setVoidTarget] = useState<CashflowLineDto | null>(null)
  const [voidBusy, setVoidBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const offset = (page - 1) * limit
    const r = await listRecentCashflow({ limit, offset, fromDate, toDate })
    setLoading(false)
    if (r.ok) {
      setRows(r.data)
    } else {
      setRows([])
      setLoadError(r.error.message)
    }
  }, [fromDate, limit, toDate, page])

  useEffect(() => {
    void load()
  }, [load])

  async function confirmVoid() {
    if (voidTarget?.saleId == null || window.deken == null) {
      return
    }
    setVoidBusy(true)
    const r = await voidCashSale(voidTarget.saleId)
    setVoidBusy(false)
    if (r.ok) {
      toast.success(t('cashflow.toast.voided'))
      setVoidTarget(null)
      void load()
    } else {
      const k = mapVoidErr(r.error.message)
      toast.error(
        k === 'generic'
          ? t('cashflow.errors.generic', { message: r.error.message })
          : t(`cashflow.errors.${k}`),
      )
    }
  }

  function kindLabel(kind: CashflowLineDto['kind']): string {
    return t(`cashflow.kinds.${kind}`)
  }

  function primaryCell(row: CashflowLineDto): string {
    if (row.kind === 'cash_sale') {
      return kindLabel(row.kind)
    }
    return row.primaryLabel?.trim() ? row.primaryLabel : kindLabel(row.kind)
  }

  function onApplyFilters(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (fromDate > toDate) {
      toast.error(t('cashflow.errors.invalid_input'))
      return
    }
    setPage(1)
    void load()
  }

  return (
    <div className="cf">
      <header className="cf__header">
        <h1 className="cf__title">{t('cashflow.pageTitle')}</h1>
        <p className="cf__intro">{t('cashflow.intro')}</p>
      </header>

      <form className="cf__toolbar" onSubmit={onApplyFilters}>
        <label>
          <div className="cf-field__label">{t('cashflow.fromLabel')}</div>
          <input
            className="cf-field__select"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label={t('cashflow.fromLabel')}
          />
        </label>
        <label>
          <div className="cf-field__label">{t('cashflow.toLabel')}</div>
          <input
            className="cf-field__select"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label={t('cashflow.toLabel')}
          />
        </label>
        <label>
          <div className="cf-field__label">{t('cashflow.limitLabel')}</div>
          <select
            className="cf-field__select"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value))
              setPage(1)
            }}
            aria-label={t('cashflow.limitLabel')}
          >
            <option value={1}>1</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
        </label>
        <button type="submit" className="cf-btn">
          {t('cashflow.applyFilters')}
        </button>
      </form>

      <section className="cf-panel">
        {loadError ? (
          <p className="cf-muted" style={{ marginTop: 0 }}>
            {t('cashflow.loadError', { message: loadError })}
          </p>
        ) : null}
        <div className="cf-table-wrap">
          <table className="cf-table">
            <thead>
              <tr>
                <th>{t('cashflow.colWhen')}</th>
                <th>{t('cashflow.colKind')}</th>
                <th>{t('cashflow.colDetail')}</th>
                <th className="cf-table__num">{t('cashflow.colAmount')}</th>
                <th>{t('cashflow.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>{t('cashflow.loading')}</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5}>{t('cashflow.empty')}</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const d = new Date(row.at)
                  return (
                    <tr key={row.rowKey}>
                      <td>{d.toLocaleString(loc)}</td>
                      <td>{kindLabel(row.kind)}</td>
                      <td>
                        <div>{primaryCell(row)}</div>
                        {row.secondaryLabel ? (
                          <div className="cf-muted">{row.secondaryLabel}</div>
                        ) : null}
                        {row.actor?.fullName ? (
                          <div className="cf-muted">
                            {t('common.byUser')}: {row.actor.fullName}
                          </div>
                        ) : null}
                      </td>
                      <td className="cf-table__num">
                        {row.amountSignedLbp >= 0 ? '+' : ''}
                        {formatLbp(row.amountSignedLbp, lng)}
                      </td>
                      <td>
                        {row.canVoid && row.saleId ? (
                          <button
                            type="button"
                            className="cf-btn cf-btn--danger"
                            onClick={() => setVoidTarget(row)}
                            disabled={window.deken == null}
                          >
                            {t('cashflow.actions.void')}
                          </button>
                        ) : (
                          <span className="cf-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div
          className="cf-pagination"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'var(--space-md)',
          }}
        >
          <p className="cf-muted" style={{ margin: 0 }}>
            {t('cashflow.hintVoid')}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="cf-btn cf-btn--ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('common.prevPage', 'Previous')}
            </button>
            <span className="cf-muted" style={{ alignSelf: 'center' }}>
              {t('common.page', 'Page')} {page}
            </span>
            <button
              type="button"
              className="cf-btn cf-btn--ghost"
              disabled={rows.length < limit || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common.nextPage', 'Next')}
            </button>
          </div>
        </div>
      </section>

      {voidTarget != null ? (
        <div
          className="cf-dim"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !voidBusy) {
              setVoidTarget(null)
            }
          }}
        >
          <div
            className="cf-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="cf-dialog__title">{t('cashflow.voidDialog.title')}</h2>
            <p>{t('cashflow.voidDialog.body')}</p>
            <div className="cf-dialog__actions">
              <button
                type="button"
                className="cf-btn"
                onClick={() => setVoidTarget(null)}
                disabled={voidBusy}
              >
                {t('cashflow.voidDialog.cancel')}
              </button>
              <button
                type="button"
                className="cf-btn cf-btn--danger"
                onClick={() => void confirmVoid()}
                disabled={voidBusy}
              >
                {voidBusy ? t('cashflow.voidDialog.working') : t('cashflow.voidDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
