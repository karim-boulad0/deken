import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/toast'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { getCustomerLedger, listCustomerBalances, recordDebtPayment } from '../../lib/api/dekenClient'
import { formatLbp, formatUsd } from '../pos/formatPos'
import { RecordPaymentDialog } from './RecordPaymentDialog'
import './DebtsPage.css'
import type { CustomerBalanceRow, CustomerLedgerLineDto } from '../../../../shared/ipc/types'

type BalanceFilter = 'all' | 'positive' | 'zero'

type LedgerState = {
  id: string | null
  loading: boolean
  error: boolean
  lines: CustomerLedgerLineDto[]
}

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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rows, setRows] = useState<CustomerBalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [payTarget, setPayTarget] = useState<CustomerBalanceRow | null>(null)
  const [payBusy, setPayBusy] = useState(false)
  const [ledger, setLedger] = useState<LedgerState>({
    id: null,
    loading: false,
    error: false,
    lines: [],
  })

  const loadLedger = useCallback(async (customerId: string) => {
    setLedger({ id: customerId, loading: true, error: false, lines: [] })
    const r = await getCustomerLedger(customerId)
    if (r.ok) {
      setLedger({ id: customerId, loading: false, error: false, lines: r.data })
    } else {
      setLedger({ id: customerId, loading: false, error: true, lines: [] })
    }
  }, [])

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

  useEffect(() => {
    if (expandedId == null) {
      setLedger({ id: null, loading: false, error: false, lines: [] })
      return
    }
    void loadLedger(expandedId)
  }, [expandedId, loadLedger])

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

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function clearFilters() {
    setQuery('')
    setBalanceFilter('all')
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
      if (expandedId === cid) {
        void loadLedger(cid)
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
                  <th scope="col">
                    <span className="debts-visually-hidden">{t('debts.table.actions')}</span>
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
                  const expanded = expandedId === row.id
                  const usd = row.balanceLbp / lbpPerUsd
                  const showLedger = expanded && ledger.id === row.id
                  return (
                    <Fragment key={row.id}>
                      <tr className={expanded ? 'debts-table__row--open' : undefined}>
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
                          <button
                            type="button"
                            className="debts-iconbtn"
                            onClick={() => toggleRow(row.id)}
                            aria-expanded={expanded}
                            aria-controls={`debt-detail-${row.id}`}
                            id={`debt-expand-${row.id}`}
                            aria-label={
                              expanded ? t('debts.actions.collapseDetails') : t('debts.actions.expandDetails')
                            }
                          >
                            {expanded ? (
                              <ChevronUp size={18} strokeWidth={2} aria-hidden />
                            ) : (
                              <ChevronDown size={18} strokeWidth={2} aria-hidden />
                            )}
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="debts-table__detail-row">
                          <td colSpan={5}>
                            <div
                              className="debts-detail"
                              id={`debt-detail-${row.id}`}
                              role="region"
                              aria-labelledby={`debt-expand-${row.id}`}
                            >
                              <h3 className="debts-detail__heading">{t('debts.ledger.title')}</h3>
                              {showLedger && ledger.loading ? (
                                <p className="debts-detail__text">{t('debts.ledger.loading')}</p>
                              ) : null}
                              {showLedger && ledger.error ? (
                                <p className="debts-detail__err" role="alert">
                                  {t('debts.ledger.loadError')}
                                </p>
                              ) : null}
                              {showLedger && !ledger.loading && !ledger.error && ledger.lines.length === 0 ? (
                                <p className="debts-detail__text">{t('debts.ledger.empty')}</p>
                              ) : null}
                              {showLedger && !ledger.loading && !ledger.error && ledger.lines.length > 0 ? (
                                <div className="debts-ledger-wrap">
                                  <table className="debts-ledger">
                                    <thead>
                                      <tr>
                                        <th scope="col">{t('debts.ledger.colType')}</th>
                                        <th scope="col">{t('debts.ledger.colWhen')}</th>
                                        <th scope="col" className="debts-ledger__num">
                                          {t('debts.ledger.colAmount')}
                                        </th>
                                        <th scope="col">{t('debts.ledger.colNote')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ledger.lines.map((line) => {
                                        const when = new Date(line.at).toLocaleString(
                                          lng.startsWith('ar') ? 'ar-LB' : 'en-US',
                                        )
                                        const isDebt = line.kind === 'debt_sale'
                                        return (
                                          <tr key={`${line.kind}-${line.id}`}>
                                            <td
                                              className={
                                                isDebt
                                                  ? 'debts-ledger__type debts-ledger__type--debt'
                                                  : 'debts-ledger__type debts-ledger__type--pay'
                                              }
                                            >
                                              {isDebt
                                                ? t('debts.ledger.typeDebt')
                                                : t('debts.ledger.typePayment')}
                                            </td>
                                            <td className="debts-ledger__when">{when}</td>
                                            <td className="debts-ledger__num debts-ledger__amount">
                                              {isDebt
                                                ? t('debts.ledger.amountCharge', {
                                                    n: formatLbp(line.amountLbp, lng),
                                                  })
                                                : t('debts.ledger.amountPayment', {
                                                    n: formatLbp(line.amountLbp, lng),
                                                  })}
                                            </td>
                                            <td className="debts-ledger__note">
                                              {line.note != null && line.note.trim() !== ''
                                                ? line.note
                                                : t('debts.ledger.noNote')}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : null}
                              <button
                                type="button"
                                className="debts-btn debts-btn--primary"
                                disabled={row.balanceLbp <= 0 || window.deken == null}
                                title={
                                  row.balanceLbp <= 0
                                    ? t('debts.actions.recordPayZeroTitle')
                                    : window.deken == null
                                      ? t('debts.actions.recordPayNoBridgeTitle')
                                      : undefined
                                }
                                onClick={() => {
                                  if (row.balanceLbp > 0 && window.deken != null) {
                                    setPayTarget(row)
                                  }
                                }}
                              >
                                {t('debts.actions.recordPay')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })
                  : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
