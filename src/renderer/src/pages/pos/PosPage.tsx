import { Minus, Plus, ScanBarcode, Trash2, Wallet } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DebtRecordDialog, type DebtRecordPayload } from './DebtRecordDialog'
import { formatLbp, formatUsd } from './formatPos'
import './PosPage.css'

/** Demo catalog: scan these codes to add lines (until real inventory is wired). */
const DEMO_SKU: Record<string, { nameKey: string; unitPriceLbp: number }> = {
  '123': { nameKey: 'pos.mockItems.water', unitPriceLbp: 500 },
  '999': { nameKey: 'pos.mockItems.bread', unitPriceLbp: 3500 },
}

const MOCK_LBP_PER_USD = 89_500

type CartLine = {
  id: string
  sku: string
  nameKey: string
  nameParams?: Record<string, string>
  qty: number
  unitPriceLbp: number
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function PosPage() {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const searchRef = useRef<HTMLInputElement>(null)
  const cartRegionId = useId()
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [loading, setLoading] = useState(true)
  const [debtOpen, setDebtOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    const tmr = window.setTimeout(() => setLoading(false), 380)
    return () => window.clearTimeout(tmr)
  }, [])

  useEffect(() => {
    if (!loading) {
      searchRef.current?.focus()
    }
  }, [loading])

  const totals = useMemo(() => {
    const subLbp = cart.reduce((s, l) => s + l.qty * l.unitPriceLbp, 0)
    const usd = subLbp / MOCK_LBP_PER_USD
    return { subLbp, usd }
  }, [cart])

  const formatted = useMemo(
    () => ({
      subLbp: formatLbp(totals.subLbp, lng),
      usd: formatUsd(totals.usd, lng),
    }),
    [lng, totals.subLbp, totals.usd],
  )

  const addFromQuery = useCallback(() => {
    const code = query.trim()
    if (!code) return
    const hit = DEMO_SKU[code]
    if (hit) {
      setCart((prev) => {
        const idx = prev.findIndex((l) => l.sku === code)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
          return next
        }
        return [
          ...prev,
          {
            id: newId(),
            sku: code,
            nameKey: hit.nameKey,
            qty: 1,
            unitPriceLbp: hit.unitPriceLbp,
          },
        ]
      })
    } else {
      setCart((prev) => [
        ...prev,
        {
          id: newId(),
          sku: code,
          nameKey: 'pos.cart.unknownName',
          nameParams: { code },
          qty: 1,
          unitPriceLbp: 0,
        },
      ])
    }
    setQuery('')
    requestAnimationFrame(() => searchRef.current?.focus())
  }, [query])

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addFromQuery()
    }
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
        .filter((l) => l.qty > 0),
    )
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.id !== id))
  }

  function clearCart() {
    setCart([])
  }

  function handlePayCash() {
    if (cart.length === 0) return
    clearCart()
    setToastMessage(t('pos.toast.paidCash'))
    window.setTimeout(() => setToastMessage(null), 4200)
  }

  function handleDebtConfirm(payload: DebtRecordPayload) {
    clearCart()
    const note = payload.note.trim()
    setToastMessage(
      note
        ? t('pos.toast.recordedDebtDetailNote', { name: payload.customerName, note })
        : t('pos.toast.recordedDebtDetail', { name: payload.customerName }),
    )
    window.setTimeout(() => setToastMessage(null), 5200)
  }

  const cartActionsDisabled = cart.length === 0

  return (
    <div className={`pos${loading ? ' pos--loading' : ''}`}>
      <header className="pos__toolbar">
        <div className="pos__toolbar-main">
          <h1 className="pos__title">{t('pos.pageTitle')}</h1>
          <p className="pos__rate" aria-live="polite">
            {t('pos.toolbar.rateLabel', {
              rate: MOCK_LBP_PER_USD.toLocaleString(lng.startsWith('ar') ? 'ar-LB' : 'en-US'),
            })}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="pos-skeleton" aria-busy="true" aria-label={t('pos.loading.aria')}>
          <div className="pos-skeleton__row" />
          <div className="pos-skeleton__row" />
          <div className="pos-skeleton__row pos-skeleton__row--short" />
        </div>
      ) : (
        <div className="pos__body">
          <section className="pos-panel pos-panel--entry" aria-labelledby="pos-entry-title">
            <h2 className="pos-panel__title" id="pos-entry-title">
              {t('pos.entry.title')}
            </h2>
            <p className="pos-panel__hint">{t('pos.entry.hint')}</p>
            <div className="pos-search">
              <label className="pos-search__label" htmlFor="pos-barcode-input">
                {t('pos.entry.fieldLabel')}
              </label>
              <div className="pos-search__row">
                <span className="pos-search__icon" aria-hidden>
                  <ScanBarcode size={22} strokeWidth={2} />
                </span>
                <input
                  id="pos-barcode-input"
                  ref={searchRef}
                  className="pos-search__input"
                  type="text"
                  inputMode="numeric"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t('pos.entry.placeholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  aria-describedby="pos-entry-desc"
                />
                <button type="button" className="pos-btn pos-btn--secondary" onClick={addFromQuery}>
                  {t('pos.entry.add')}
                </button>
              </div>
              <p className="pos-search__desc" id="pos-entry-desc">
                {t('pos.entry.demoCodes')}
              </p>
            </div>
          </section>

          <div className="pos__stack">
            <section className="pos-summary" aria-labelledby="pos-summary-title">
              <h2 className="pos-visually-hidden" id="pos-summary-title">
                {t('pos.summary.title')}
              </h2>
              <div className="pos-summary__rows">
                <div className="pos-summary__row">
                  <span>{t('pos.summary.subtotal')}</span>
                  <span className="pos-summary__value">{formatted.subLbp}</span>
                </div>
                <div className="pos-summary__row pos-summary__row--accent">
                  <span>{t('pos.summary.totalLbp')}</span>
                  <span className="pos-summary__value">{formatted.subLbp}</span>
                </div>
                <div className="pos-summary__row">
                  <span>{t('pos.summary.totalUsd')}</span>
                  <span className="pos-summary__value">{formatted.usd}</span>
                </div>
              </div>
              <div className="pos-summary__actions">
                <button
                  type="button"
                  className="pos-btn pos-btn--primary pos-btn--checkout"
                  disabled={cartActionsDisabled}
                  onClick={handlePayCash}
                >
                  {t('pos.summary.payCash')}
                </button>
                <button
                  type="button"
                  className="pos-btn pos-btn--debt pos-btn--checkout"
                  disabled={cartActionsDisabled}
                  onClick={() => setDebtOpen(true)}
                >
                  <Wallet size={16} strokeWidth={2} aria-hidden className="pos-btn__icon" />
                  {t('pos.summary.payDebt')}
                </button>
              </div>
            </section>

            <section
              className="pos-panel pos-panel--cart"
              aria-labelledby="pos-cart-title"
              id={cartRegionId}
            >
              <div className="pos-panel__head">
                <h2 className="pos-panel__title" id="pos-cart-title">
                  {t('pos.cart.title')}
                </h2>
                {cart.length > 0 ? (
                  <button type="button" className="pos-link" onClick={clearCart}>
                    {t('pos.cart.clear')}
                  </button>
                ) : null}
              </div>

              {cart.length === 0 ? (
                <div className="pos-empty" role="status">
                  <div className="pos-empty__icon" aria-hidden>
                    <ScanBarcode size={36} strokeWidth={1.5} />
                  </div>
                  <p className="pos-empty__title">{t('pos.cart.emptyTitle')}</p>
                  <p className="pos-empty__text">{t('pos.cart.emptyBody')}</p>
                </div>
              ) : (
                <div className="pos-table-wrap">
                  <table className="pos-table">
                    <colgroup>
                      <col className="pos-table__col-product" />
                      <col className="pos-table__col-sku" />
                      <col className="pos-table__col-qty" />
                      <col className="pos-table__col-price" />
                      <col className="pos-table__col-line" />
                      <col className="pos-table__col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">{t('pos.cart.colProduct')}</th>
                        <th scope="col">{t('pos.cart.colSku')}</th>
                        <th scope="col" className="pos-table__num">
                          {t('pos.cart.colQty')}
                        </th>
                        <th scope="col" className="pos-table__num">
                          {t('pos.cart.colPrice')}
                        </th>
                        <th scope="col" className="pos-table__num">
                          {t('pos.cart.colLine')}
                        </th>
                        <th scope="col">
                          <span className="pos-visually-hidden">{t('pos.cart.colActions')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((line) => {
                        const lineTotal = line.qty * line.unitPriceLbp
                        const label = line.nameParams
                          ? t(line.nameKey, line.nameParams)
                          : t(line.nameKey)
                        return (
                          <tr key={line.id}>
                            <td className="pos-table__cell-truncate">
                              <span className="pos-table__ellipsis" title={label}>
                                {label}
                              </span>
                            </td>
                            <td className="pos-table__cell-sku">
                              <code className="pos-code" title={line.sku}>
                                {line.sku}
                              </code>
                            </td>
                            <td className="pos-table__cell-qty pos-table__num">
                              <div className="pos-qty">
                                <button
                                  type="button"
                                  className="pos-qty__btn"
                                  onClick={() => updateQty(line.id, -1)}
                                  aria-label={t('pos.cart.decQty')}
                                >
                                  <Minus size={16} strokeWidth={2} aria-hidden />
                                </button>
                                <span className="pos-qty__val">{line.qty}</span>
                                <button
                                  type="button"
                                  className="pos-qty__btn"
                                  onClick={() => updateQty(line.id, 1)}
                                  aria-label={t('pos.cart.incQty')}
                                >
                                  <Plus size={16} strokeWidth={2} aria-hidden />
                                </button>
                              </div>
                            </td>
                            <td className="pos-table__cell-money pos-table__num">
                              {formatLbp(line.unitPriceLbp, lng)}
                            </td>
                            <td className="pos-table__cell-money pos-table__num pos-table__strong">
                              {formatLbp(lineTotal, lng)}
                            </td>
                            <td className="pos-table__cell-actions">
                              <button
                                type="button"
                                className="pos-iconbtn"
                                onClick={() => removeLine(line.id)}
                                aria-label={t('pos.cart.removeLine')}
                              >
                                <Trash2 size={18} strokeWidth={2} aria-hidden />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      <DebtRecordDialog
        open={debtOpen}
        onOpenChange={setDebtOpen}
        totalLbpDisplay={formatted.subLbp}
        totalUsdDisplay={formatted.usd}
        lineCount={cart.length}
        onConfirm={handleDebtConfirm}
      />

      {toastMessage ? (
        <div className="pos-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}
    </div>
  )
}
