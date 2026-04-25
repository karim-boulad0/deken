import { Download, Eye, Search, Wallet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/toast'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { listCustomerBalances, recordDebtPayment } from '../../lib/api/dekenClient'
import { downloadAsCsvFile, fileDateStamp, toCsvLine } from '../../lib/csvExport'
import { formatLbp, formatUsd } from '../pos/formatPos'
import { CustomerHistoryDialog } from './CustomerHistoryDialog'
import { RecordPaymentDialog } from './RecordPaymentDialog'
import './DebtsPage.css'
import type { CustomerBalanceRow } from '../../../../shared/ipc/types'

type BalanceFilter = 'all' | 'positive' | 'zero'

function mapPayError(m: string): string {
  const s = m.trim()
  if (
    s === 'amount_invalid' ||
    s === 'payment_exceeds_balance' ||
    s === 'no_outstanding_balance' ||
    s === 'customer_not_found' ||
    s === 'invalid_input'
  ) {
    return s
  }
  return 'generic'
}

export function DebtsPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { settings } = useAppSettings()
  const lbpPerUsd = settings.lbpPerUsd
  const lng = i18n.language
  const [query, setQuery] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all')
  const [rows, setRows] = useState<CustomerBalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [payTarget, setPayTarget] = useState<CustomerBalanceRow | null>(null)
  const [payBusy, setPayBusy] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<CustomerBalanceRow | null>(null)
  const [ledgerRefresh, setLedgerRefresh] = useState(0)

  const load = useCallback(async () => {
    setLoadError(false)
    setLoading(true)
    const r = await listCustomerBalances()
    if (r.ok) {
      setRows(r.data)
    } else {
      setLoadError(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let list = rows
    if (balanceFilter === 'positive') {
      list = list.filter((r) => r.balanceLbp > 0)
    } else if (balanceFilter === 'zero') {
      list = list.filter((r) => r.balanceLbp === 0)
    }
    const q = query.trim().toLowerCase()
    if (!q) {
      return list
    }
    return list.filter((row) => {
      const name = row.name.toLowerCase()
      const phone = (row.phone ?? '').toLowerCase()
      return name.includes(q) || phone.includes(q)
    })
  }, [query, balanceFilter, rows])

  const showEmptySearch = query.trim().length > 0 && filtered.length === 0
  const showEmptyFilter =
    query.trim().length === 0 && filtered.length === 0 && balanceFilter !== 'all' && !loading
  const showLedgerEmpty =
    !loadError &&
    !loading &&
    rows.length === 0 &&
    query.trim().length === 0 &&
    balanceFilter === 'all'

  function clearFilters() {
    setQuery('')
    setBalanceFilter('all')
  }

  function runExportBalances() {
    if (filtered.length === 0) {
      toast.warning(t('common.exportEmpty'))
      return
    }
    const h = toCsvLine([
      t('debts.table.customer'),
      t('debts.table.phone'),
      'balance_lbp',
      'approx_usd',
    ])
    const body = filtered.map((r) => {
      const usd = r.balanceLbp / lbpPerUsd
      return toCsvLine([
        r.name,
        r.phone ?? '',
        r.balanceLbp,
        usd,
      ])
    })
    downloadAsCsvFile(`deken-debts-${fileDateStamp()}`, [h, ...body])
    toast.success(t('common.exportToast'))
  }

  async function submitPayment(amountLbp: number, note: string) {
    if (payTarget == null || window.deken == null) {
      return
    }
    setPayBusy(true)
    const r = await recordDebtPayment({
      customerId: payTarget.id,
      amountLbp,
      note: note || undefined,
    })
    setPayBusy(false)
    if (r.ok) {
      const cid = payTarget.id
      toast.success(t('debts.payDialog.toastSaved', { lbp: formatLbp(amountLbp, lng) }))
      setPayTarget(null)
      void load()
      if (historyTarget != null && historyTarget.id === cid) {
        setLedgerRefresh((n) => n + 1)
      }
    } else {
      const k = mapPayError(r.error.message)
      if (k === 'payment_exceeds_balance' && payTarget) {
        toast.error(
          t('debts.errors.payment_exceeds_balance', { max: formatLbp(payTarget.balanceLbp, lng) }),
          5000,
        )
      } else {
        toast.error(
          k === 'generic' ? t('debts.errors.generic', { message: r.error.message }) : t(`debts.errors.${k}`),
          5000,
        )
      }
    }
  }

  return (
    <div className="debts">
      <header className="debts__header">
        <h1 className="debts__title" id="debts-page-title">
          {t('debts.pageTitle')}
        </h1>
        <p className="debts__intro">{t('debts.intro')}</p>
      </header>

      <div className="debts__toolbar" role="search">
        <div className="debts__search">
          <span className="debts__search-icon" aria-hidden>
            <Search size={20} strokeWidth={2} />
          </span>
          <input
            className="debts__search-input"
            type="search"
            autoComplete="off"
            placeholder={t('debts.toolbar.searchPlaceholder')}
            aria-label={t('debts.toolbar.searchAria')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="debts__toolbar-end">
          <label className="debts__filter">
            <span className="debts__filter-label">{t('debts.toolbar.balanceFilterLabel')}</span>
            <select
              className="debts__filter-select"
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value as BalanceFilter)}
              aria-label={t('debts.toolbar.balanceFilterLabel')}
            >
              <option value="all">{t('debts.toolbar.filterAll')}</option>
              <option value="positive">{t('debts.toolbar.filterPositive')}</option>
              <option value="zero">{t('debts.toolbar.filterZero')}</option>
            </select>
          </label>
          <button
            type="button"
            className="debts-btn debts-btn--ghost"
            onClick={runExportBalances}
            disabled={loading || loadError || filtered.length === 0}
            title={t('common.exportAria')}
            aria-label={t('common.exportAria')}
          >
            <Download size={18} strokeWidth={2} aria-hidden />
            {t('common.export')}
          </button>
        </div>
      </div>

      <section className="debts-panel" aria-labelledby="debts-table-title">
        <div className="debts-panel__head">
          <h2 className="debts-panel__title" id="debts-table-title">
            {t('debts.table.sectionTitle')}
          </h2>
        </div>

        {showEmptySearch ? (
          <div className="debts-empty" role="status">
            <p className="debts-empty__title">{t('debts.empty.noSearchTitle')}</p>
            <p className="debts-empty__body">{t('debts.empty.noSearchBody')}</p>
            <button type="button" className="debts-btn debts-btn--ghost" onClick={() => setQuery('')}>
              {t('debts.empty.clearSearch')}
            </button>
          </div>
        ) : showEmptyFilter ? (
          <div className="debts-empty" role="status">
            <p className="debts-empty__title">{t('debts.empty.noFilterTitle')}</p>
            <p className="debts-empty__body">{t('debts.empty.noFilterBody')}</p>
            <button type="button" className="debts-btn debts-btn--ghost" onClick={clearFilters}>
              {t('debts.empty.resetFilters')}
            </button>
          </div>
        ) : loadError ? (
          <div className="debts-empty" role="status">
            <p className="debts-empty__title">{t('debts.loadError')}</p>
            <button type="button" className="debts-btn debts-btn--primary" onClick={load}>
              {t('debts.retryLoad')}
            </button>
          </div>
        ) : showLedgerEmpty ? (
          <div className="debts-empty" role="status">
            <p className="debts-empty__title">{t('debts.empty.noDebtorsTitle')}</p>
            <p className="debts-empty__body">{t('debts.empty.noDebtorsBody')}</p>
          </div>
        ) : (
          <div className="debts-table-wrap">
            <table className="debts-table">
              <colgroup>
                <col className="debts-table__col-name" />
                <col className="debts-table__col-phone" />
                <col className="debts-table__col-lbp" />
                <col className="debts-table__col-usd" />
                <col className="debts-table__col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">{t('debts.table.customer')}</th>
                  <th scope="col">{t('debts.table.phone')}</th>
                  <th scope="col" className="debts-table__num">
                    {t('debts.table.balanceLbp')}
                  </th>
                  <th scope="col" className="debts-table__num">
                    {t('debts.table.balanceUsd')}
                  </th>
                  <th scope="col" className="debts-table__th-actions">
                    {t('debts.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="debts-table__cell-muted">
                      {t('debts.loading')}
                    </td>
                  </tr>
                ) : null}
                {!loading
                  ? filtered.map((row) => {
                      const usd = row.balanceLbp / lbpPerUsd
                      return (
                        <tr key={row.id}>
                          <td className="debts-table__cell-strong debts-table__cell-truncate">
                            <span className="debts-table__ellipsis" title={row.name}>
                              {row.name}
                            </span>
                          </td>
                          <td className="debts-table__cell-muted">
                            {row.phone && row.phone.trim() !== '' ? row.phone : t('debts.table.noPhone')}
                          </td>
                          <td className="debts-table__num debts-table__cell-strong">
                            {formatLbp(row.balanceLbp, lng)}
                          </td>
                          <td className="debts-table__num debts-table__cell-muted">
                            {formatUsd(usd, lng)}
                          </td>
                          <td className="debts-table__actions">
                            <div className="debts-table__action-group">
                              <button
                                type="button"
                                className="debts-iconbtn debts-iconbtn--pay"
                                onClick={() => {
                                  if (row.balanceLbp > 0 && window.deken != null) {
                                    setPayTarget(row)
                                  }
                                }}
                                disabled={row.balanceLbp <= 0 || window.deken == null}
                                title={
                                  row.balanceLbp <= 0
                                    ? t('debts.actions.recordPayZeroTitle')
                                    : window.deken == null
                                      ? t('debts.actions.recordPayNoBridgeTitle')
                                      : t('debts.actions.recordPay')
                                }
                                aria-label={t('debts.actions.ariaRecordPay', { name: row.name })}
                              >
                                <Wallet size={18} strokeWidth={2} aria-hidden />
                              </button>
                              <button
                                type="button"
                                className="debts-iconbtn debts-iconbtn--history"
                                onClick={() => {
                                  setHistoryTarget(row)
                                }}
                                title={t('debts.actions.viewHistory')}
                                aria-label={t('debts.actions.ariaViewHistory', { name: row.name })}
                              >
                                <Eye size={18} strokeWidth={2} aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {historyTarget != null ? (
        <CustomerHistoryDialog
          row={historyTarget}
          refreshTrigger={ledgerRefresh}
          onClose={() => {
            setHistoryTarget(null)
          }}
        />
      ) : null}

      {payTarget != null ? (
        <RecordPaymentDialog
          row={payTarget}
          lbpPerUsd={lbpPerUsd}
          onClose={() => {
            if (!payBusy) {
              setPayTarget(null)
            }
          }}
          onSave={submitPayment}
          busy={payBusy}
        />
      ) : null}
    </div>
  )
}
