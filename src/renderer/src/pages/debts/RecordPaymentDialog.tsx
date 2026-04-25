import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatLbp, formatUsd } from '../pos/formatPos'
import type { CustomerBalanceRow } from '../../../../shared/ipc/types'
import './RecordPaymentDialog.css'

type Props = {
  row: CustomerBalanceRow
  lbpPerUsd: number
  onClose: () => void
  onSave: (amountLbp: number, note: string) => Promise<void>
  busy: boolean
}

function parseLbp(s: string): { ok: true; n: number } | { ok: false } {
  const t = s.trim().replace(/[\s,٬]/g, '')
  if (t === '' || t === '0') {
    return { ok: false }
  }
  if (!/^\d+$/.test(t)) {
    return { ok: false }
  }
  const n = Number(t)
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false }
  }
  return { ok: true, n }
}

export function RecordPaymentDialog({ row, lbpPerUsd, onClose, onSave, busy }: Props) {
  const { t, i18n } = useTranslation()
  const titleId = useId()
  const [amountStr, setAmountStr] = useState('')
  const [note, setNote] = useState('')
  const [localErr, setLocalErr] = useState<string | null>(null)
  const lng = i18n.language

  useEffect(() => {
    setLocalErr(null)
  }, [amountStr, note])

  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !busy) {
      onClose()
    }
  }

  const maxPay = row.balanceLbp
  const approxUsd = maxPay / lbpPerUsd

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalErr(null)
    const p = parseLbp(amountStr)
    if (!p.ok) {
      setLocalErr(t('debts.payDialog.errorAmountRequired'))
      return
    }
    if (p.n > maxPay) {
      setLocalErr(
        t('debts.errors.payment_exceeds_balance', { max: formatLbp(maxPay, lng) }),
      )
      return
    }
    await onSave(p.n, note.trim())
  }

  return (
    <div className="dpay-dim" role="presentation" onClick={onBackdrop}>
      <form
        className="dpay-dialog"
        onSubmit={(e) => void onSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby={titleId}
      >
        <h2 className="dpay-dialog__title" id={titleId}>
          {t('debts.payDialog.title')}
        </h2>
        <p className="dpay-dialog__balance">
          {t('debts.payDialog.customer', { name: row.name })}
        </p>
        <p className="dpay-dialog__balance">
          {t('debts.payDialog.outstanding', {
            lbp: formatLbp(maxPay, lng),
            usd: formatUsd(approxUsd, lng),
          })}
        </p>
        <label className="dpay-field">
          <span className="dpay-field__label">{t('debts.payDialog.amountLabel')}</span>
          <input
            className="dpay-field__input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            disabled={busy}
            aria-describedby={`${titleId}-hint`}
            id={`${titleId}-amount`}
            placeholder="0"
          />
          <p className="dpay-field__hint" id={`${titleId}-hint`}>
            {t('debts.payDialog.maxHint', { max: formatLbp(maxPay, lng) })}
          </p>
        </label>
        <label className="dpay-field">
          <span className="dpay-field__label">{t('debts.payDialog.noteLabel')}</span>
          <textarea
            className="dpay-field__textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            placeholder={t('debts.payDialog.notePlaceholder')}
            maxLength={500}
            rows={2}
          />
        </label>
        {localErr ? <p className="dpay-err">{localErr}</p> : null}
        <div className="dpay-dialog__actions">
          <button
            type="button"
            className="dpay-btn dpay-btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            {t('debts.payDialog.cancel')}
          </button>
          <button type="submit" className="dpay-btn dpay-btn--primary" disabled={busy}>
            {busy ? t('debts.payDialog.saving') : t('debts.payDialog.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
