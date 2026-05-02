import { type FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCustomerLedger, listCustomerBalances } from '../../lib/api/dekenClient'
import type { CustomerBalanceRow, CustomerLedgerLineDto } from '../../../../shared/ipc/types'
import { formatLbp } from './formatPos'

export type DebtRecordPayload = {
  mode: 'existing' | 'new'
  debtorId: string | null
  customerName: string
  customerPhone: string
  /** Optional memo on this debt line (e.g. promise date, context). */
  note: string
}

type DebtRecordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalLbpDisplay: string
  totalUsdDisplay: string
  lineCount: number
  /** Return `true` to close, `false` to keep open (e.g. validation/IPC error). */
  onConfirm: (payload: DebtRecordPayload) => boolean | Promise<boolean>
}

type DebtorMode = 'existing' | 'new'

type ErrorKey = 'nameRequired' | 'debtorRequired' | null

export function DebtRecordDialog({
  open,
  onOpenChange,
  totalLbpDisplay,
  totalUsdDisplay,
  lineCount,
  onConfirm,
}: DebtRecordDialogProps) {
  const { t, i18n } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descId = useId()
  const errorId = useId()
  const listboxId = useId()
  const noteHintId = useId()

  const [mode, setMode] = useState<DebtorMode>('existing')
  const [pickerQuery, setPickerQuery] = useState('')
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [errorKey, setErrorKey] = useState<ErrorKey>(null)
  const [customers, setCustomers] = useState<CustomerBalanceRow[]>([])
  const [loadError, setLoadError] = useState(false)

  const [history, setHistory] = useState<CustomerLedgerLineDto[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const loadCustomers = useCallback(async () => {
    setLoadError(false)
    const r = await listCustomerBalances()
    if (r.ok) {
      setCustomers(r.data)
    } else {
      setLoadError(true)
    }
  }, [])

  const loadHistory = useCallback(async (customerId: string) => {
    setIsLoadingHistory(true)
    setHistory([])
    const r = await getCustomerLedger(customerId)
    if (r.ok) {
      // We only want the last 3 purchases (debt_sale) or items
      // User said "last 3 purchases", so we'll filter for debt_sale
      const purchases = r.data.filter((line) => line.kind === 'debt_sale').slice(0, 3)
      setHistory(purchases)
    }
    setIsLoadingHistory(false)
  }, [])

  useEffect(() => {
    if (mode === 'existing' && selectedDebtorId) {
      void loadHistory(selectedDebtorId)
    } else {
      setHistory([])
    }
  }, [mode, selectedDebtorId, loadHistory])

  const filteredDebtors = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    if (!q) {
      return customers
    }
    return customers.filter((row) => {
      const p = (row.phone ?? '').toLowerCase()
      return (
        row.name.toLowerCase().includes(q) || (p.length > 0 && p.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
      )
    })
  }, [customers, pickerQuery])

  const canConfirm =
    mode === 'existing' ? selectedDebtorId !== null : name.trim().length > 0

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      void loadCustomers()
      setMode('existing')
      setPickerQuery('')
      setSelectedDebtorId(null)
      setName('')
      setPhone('')
      setNote('')
      setErrorKey(null)
      el.showModal()
      requestAnimationFrame(() => {
        searchRef.current?.focus()
      })
    } else if (el.open) {
      el.close()
    }
  }, [open, loadCustomers])

  function setModeAndFocus(next: DebtorMode) {
    setMode(next)
    setErrorKey(null)
    requestAnimationFrame(() => {
      if (next === 'existing') {
        searchRef.current?.focus()
      } else {
        nameRef.current?.focus()
      }
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'existing') {
      if (!selectedDebtorId) {
        setErrorKey('debtorRequired')
        return
      }
      const row = customers.find((r) => r.id === selectedDebtorId)
      if (!row) {
        return
      }
      const payload: DebtRecordPayload = {
        mode: 'existing',
        debtorId: selectedDebtorId,
        customerName: row.name,
        customerPhone: row.phone ?? '',
        note: note.trim(),
      }
      void (async () => {
        const out = onConfirm(payload)
        const ok = await Promise.resolve(out)
        if (ok) {
          onOpenChange(false)
        }
      })()
    } else {
      const trimmed = name.trim()
      if (!trimmed) {
        setErrorKey('nameRequired')
        return
      }
      const payload: DebtRecordPayload = {
        mode: 'new',
        debtorId: null,
        customerName: trimmed,
        customerPhone: phone.trim(),
        note: note.trim(),
      }
      void (async () => {
        const out = onConfirm(payload)
        const ok = await Promise.resolve(out)
        if (ok) {
          onOpenChange(false)
        }
      })()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="pos-dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={() => onOpenChange(false)}
    >
      <form className="pos-dialog__form" onSubmit={handleSubmit}>
        <header className="pos-dialog__header">
          <h2 className="pos-dialog__title" id={titleId}>
            {t('pos.debt.title')}
          </h2>
          <p className="pos-dialog__desc" id={descId}>
            {t('pos.debt.subtitle')}
          </p>
        </header>

        <div className="pos-dialog__amounts" role="group" aria-label={t('pos.debt.amountsAria')}>
          <div className="pos-dialog__amount-row">
            <span className="pos-dialog__amount-label">{t('pos.summary.totalLbp')}</span>
            <span className="pos-dialog__amount-value">{totalLbpDisplay}</span>
          </div>
          <div className="pos-dialog__amount-row">
            <span className="pos-dialog__amount-label">{t('pos.summary.totalUsd')}</span>
            <span className="pos-dialog__amount-value">{totalUsdDisplay}</span>
          </div>
          <p className="pos-dialog__lines">{t('pos.debt.lineCount', { count: lineCount })}</p>
        </div>

        <fieldset className="pos-debt-mode">
          <legend className="pos-field__label">{t('pos.debt.modeLegend')}</legend>
          <div className="pos-segment" role="radiogroup" aria-label={t('pos.debt.modeAria')}>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'existing'}
              className={`pos-segment__btn${mode === 'existing' ? ' pos-segment__btn--active' : ''}`}
              onClick={() => setModeAndFocus('existing')}
            >
              {t('pos.debt.mode.existing')}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'new'}
              className={`pos-segment__btn${mode === 'new' ? ' pos-segment__btn--active' : ''}`}
              onClick={() => setModeAndFocus('new')}
            >
              {t('pos.debt.mode.new')}
            </button>
          </div>
        </fieldset>

        {mode === 'existing' ? (
          <div className="pos-dialog__fields">
            {loadError ? (
              <p className="pos-dialog__error" role="alert">
                {t('pos.debt.errors.loadCustomers')}
              </p>
            ) : null}
            <label className="pos-field">
              <span className="pos-field__label">{t('pos.debt.fields.searchExisting')}</span>
              <input
                ref={searchRef}
                className="pos-field__input"
                type="search"
                autoComplete="off"
                value={pickerQuery}
                onChange={(e) => {
                  setPickerQuery(e.target.value)
                  setSelectedDebtorId(null)
                  setErrorKey(null)
                }}
                aria-controls={listboxId}
              />
            </label>
            <p className="pos-dialog__hint pos-dialog__hint--tight">{t('pos.debt.fields.pickOne')}</p>
            <div
              id={listboxId}
              className="pos-debtor-list"
              role="listbox"
              aria-label={t('pos.debt.fields.searchExisting')}
            >
              {filteredDebtors.length === 0 ? (
                <p className="pos-debtor-list__empty" role="status">
                  {t('pos.debt.fields.noDebtorMatch')}
                </p>
              ) : (
                filteredDebtors.map((row) => {
                  const selected = selectedDebtorId === row.id
                  return (
                    <button
                      key={row.id}
                      type="button"
                      id={`debtor-${row.id}`}
                      role="option"
                      aria-selected={selected}
                      className={`pos-debtor-row${selected ? ' pos-debtor-row--selected' : ''}`}
                      onClick={() => {
                        setSelectedDebtorId(row.id)
                        setErrorKey(null)
                      }}
                    >
                      <span className="pos-debtor-row__name">{row.name}</span>
                      {row.phone ? (
                        <span className="pos-debtor-row__phone">{row.phone}</span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
            {errorKey === 'debtorRequired' ? (
              <p className="pos-dialog__error" id={errorId} role="alert">
                {t('pos.debt.errors.debtorRequired')}
              </p>
            ) : null}

            {mode === 'existing' && selectedDebtorId ? (
              <div className="pos-history-card">
                <header className="pos-history-card__header">
                  <h3 className="pos-history-card__title">{t('pos.debt.quickHistory.title')}</h3>
                  <div className="pos-history-card__balance">
                    <span className="pos-history-card__balance-label">
                      {t('pos.debt.quickHistory.balance')}
                    </span>
                    <span
                      className={`pos-history-card__balance-value${
                        (customers.find((c) => c.id === selectedDebtorId)?.balanceLbp ?? 0) === 0
                          ? ' pos-history-card__balance-value--zero'
                          : ''
                      }`}
                    >
                      {formatLbp(
                        customers.find((c) => c.id === selectedDebtorId)?.balanceLbp ?? 0,
                        i18n.language,
                      )}
                    </span>
                  </div>
                </header>

                <div className="pos-history-list">
                  <span className="pos-field__label">
                    {t('pos.debt.quickHistory.lastPurchases')}
                  </span>
                  {isLoadingHistory ? (
                    <div className="pos-history-card__loading">
                      {t('pos.debt.quickHistory.loading')}
                    </div>
                  ) : history.length === 0 ? (
                    <div className="pos-history-card__empty">
                      {t('pos.debt.quickHistory.noHistory')}
                    </div>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="pos-history-item">
                        <div className="pos-history-item__main">
                          <span className="pos-history-item__type">
                            {t(`pos.debt.quickHistory.typeDebt`)}
                          </span>
                          <span className="pos-history-item__date">
                            {new Date(item.at).toLocaleDateString(i18n.language.startsWith('ar') ? 'ar-LB' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <span className="pos-history-item__amount">{formatLbp(item.amountLbp, i18n.language)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="pos-dialog__fields">
            <label className="pos-field">
              <span className="pos-field__label">{t('pos.debt.fields.name')}</span>
              <input
                ref={nameRef}
                className="pos-field__input"
                type="text"
                name="customerName"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setErrorKey(null)
                }}
                aria-invalid={errorKey === 'nameRequired' ? true : undefined}
                aria-errormessage={errorKey === 'nameRequired' ? errorId : undefined}
              />
            </label>
            {errorKey === 'nameRequired' ? (
              <p className="pos-dialog__error" id={errorId} role="alert">
                {t('pos.debt.errors.nameRequired')}
              </p>
            ) : null}
            <label className="pos-field">
              <span className="pos-field__label">{t('pos.debt.fields.phone')}</span>
              <input
                className="pos-field__input"
                type="tel"
                name="customerPhone"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <p className="pos-dialog__hint">{t('pos.debt.fields.hint')}</p>
          </div>
        )}

        <div className="pos-dialog__fields pos-dialog__fields--note">
          <label className="pos-field">
            <span className="pos-field__label">{t('pos.debt.fields.note')}</span>
            <textarea
              className="pos-field__textarea"
              name="debtNote"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('pos.debt.fields.notePlaceholder')}
              aria-describedby={noteHintId}
            />
          </label>
          <p className="pos-dialog__hint" id={noteHintId}>
            {t('pos.debt.fields.noteHint')}
          </p>
        </div>

        <footer className="pos-dialog__footer">
          <button
            type="button"
            className="pos-btn pos-btn--ghost"
            onClick={() => dialogRef.current?.close()}
          >
            {t('pos.debt.actions.cancel')}
          </button>
          <button type="submit" className="pos-btn pos-btn--primary" disabled={!canConfirm}>
            {t('pos.debt.actions.confirm')}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
