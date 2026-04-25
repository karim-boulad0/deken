import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listCustomerBalances } from '../../lib/api/dekenClient'
import { formatLbp, formatUsd } from '../pos/formatPos'
import './DebtsPage.css'
import type { CustomerBalanceRow } from '../../../../shared/ipc/types'

const MOCK_LBP_PER_USD = 89_500

type BalanceFilter = 'all' | 'positive' | 'zero'

export function DebtsPage() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const [query, setQuery] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rows, setRows] = useState<CustomerBalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

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

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function clearFilters() {
    setQuery('')
    setBalanceFilter('all')
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
                  const usd = row.balanceLbp / MOCK_LBP_PER_USD
                  const lastAt =
                    row.lastDebtSaleAt != null
                      ? new Date(row.lastDebtSaleAt).toLocaleString(
                          lng.startsWith('ar') ? 'ar-LB' : 'en-US',
                        )
                      : null
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
                              <p className="debts-detail__label">{t('debts.detail.activityLabel')}</p>
                              <p className="debts-detail__text">
                                {lastAt
                                  ? t('debts.detail.lastSale', { at: lastAt })
                                  : t('debts.detail.noSalesYet')}
                              </p>
                              <button
                                type="button"
                                className="debts-btn debts-btn--primary"
                                disabled
                                title={t('debts.actions.recordPayDisabledTitle')}
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
    </div>
  )
}
