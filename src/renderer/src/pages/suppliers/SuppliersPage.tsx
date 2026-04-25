import { Eye, Plus } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/toast'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import {
  createSupplier,
  createSupplierInvoice,
  createSupplierPayment,
  deleteSupplier,
  listSupplierBalances,
  updateSupplier,
} from '../../lib/api/dekenClient'
import { formatLbp, formatUsd } from '../pos/formatPos'
import type { SupplierBalanceRow } from '../../../../shared/ipc/types'
import { SupplierHistoryDialog } from './SupplierHistoryDialog'
import './SuppliersPage.css'

type BalFilter = 'all' | 'owes' | 'zero'

function localYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mapErr(m: string): string {
  const s = m.trim()
  const keys = [
    'name_required',
    'supplier_not_found',
    'amount_invalid',
    'invalid_date',
    'name_too_long',
    'note_too_long',
    'reference_too_long',
  ]
  if (keys.includes(s)) {
    return s
  }
  return 'generic'
}

export function SuppliersPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { settings } = useAppSettings()
  const lng = i18n.language
  const lbpPerUsd = settings.lbpPerUsd
  const [rows, setRows] = useState<SupplierBalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [query, setQuery] = useState('')
  const [balFilter, setBalFilter] = useState<BalFilter>('all')

  const [modal, setModal] = useState<
    | { type: 'closed' }
    | { type: 'create' }
    | { type: 'edit'; row: SupplierBalanceRow }
    | { type: 'invoice'; row: SupplierBalanceRow }
    | { type: 'payment'; row: SupplierBalanceRow }
    | { type: 'delete'; row: SupplierBalanceRow }
  >({ type: 'closed' })

  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formNote, setFormNote] = useState('')
  const [invDate, setInvDate] = useState(localYmd)
  const [invAmount, setInvAmount] = useState('')
  const [invRef, setInvRef] = useState('')
  const [invNote, setInvNote] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [historyTarget, setHistoryTarget] = useState<SupplierBalanceRow | null>(null)
  const [ledgerRefresh, setLedgerRefresh] = useState(0)
  const dlgTitleId = useId()

  const load = useCallback(async () => {
    setLoadError(false)
    setLoading(true)
    const r = await listSupplierBalances()
    setLoading(false)
    if (r.ok) {
      setRows(r.data)
    } else {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let list = rows
    if (balFilter === 'owes') {
      list = list.filter((r) => r.balanceLbp > 0)
    } else if (balFilter === 'zero') {
      list = list.filter((r) => r.balanceLbp === 0)
    }
    const q = query.trim().toLowerCase()
    if (!q) {
      return list
    }
    return list.filter((r) => {
      const name = r.name.toLowerCase()
      const phone = (r.phone ?? '').toLowerCase()
      const note = (r.note ?? '').toLowerCase()
      return name.includes(q) || phone.includes(q) || note.includes(q)
    })
  }, [query, balFilter, rows])

  function openCreate() {
    setFormErr(null)
    setFormName('')
    setFormPhone('')
    setFormNote('')
    setModal({ type: 'create' })
  }

  function openEdit(row: SupplierBalanceRow) {
    setFormErr(null)
    setFormName(row.name)
    setFormPhone(row.phone ?? '')
    setFormNote(row.note ?? '')
    setModal({ type: 'edit', row })
  }

  function openInvoice(row: SupplierBalanceRow) {
    setFormErr(null)
    setInvDate(localYmd())
    setInvAmount('')
    setInvRef('')
    setInvNote('')
    setModal({ type: 'invoice', row })
  }

  function openPayment(row: SupplierBalanceRow) {
    setFormErr(null)
    setPayAmount('')
    setPayNote('')
    setModal({ type: 'payment', row })
  }

  async function saveSupplier() {
    if (window.deken == null) {
      return
    }
    setBusy(true)
    setFormErr(null)
    const name = formName.trim()
    if (name.length === 0) {
      setFormErr(t('suppliers.errors.name_required'))
      setBusy(false)
      return
    }
    if (modal.type === 'create') {
      const r = await createSupplier({
        name,
        phone: formPhone.trim() || undefined,
        note: formNote.trim() || undefined,
      })
      setBusy(false)
      if (r.ok) {
        toast.success(t('suppliers.toast.created'))
        setModal({ type: 'closed' })
        void load()
      } else {
        const k = mapErr(r.error.message)
        setFormErr(k === 'generic' ? t('suppliers.errors.generic', { message: r.error.message }) : t(`suppliers.errors.${k}`))
      }
    } else if (modal.type === 'edit') {
      const r = await updateSupplier(modal.row.id, {
        name,
        phone: formPhone.trim() || null,
        note: formNote.trim() || null,
      })
      setBusy(false)
      if (r.ok) {
        toast.success(t('suppliers.toast.updated'))
        setModal({ type: 'closed' })
        void load()
      } else {
        const k = mapErr(r.error.message)
        setFormErr(k === 'generic' ? t('suppliers.errors.generic', { message: r.error.message }) : t(`suppliers.errors.${k}`))
      }
    }
  }

  async function saveInvoice() {
    if (modal.type !== 'invoice' || window.deken == null) {
      return
    }
    setBusy(true)
    setFormErr(null)
    const n = Math.floor(Number(invAmount))
    if (!Number.isInteger(n) || n < 1) {
      setFormErr(t('suppliers.errors.amount_invalid'))
      setBusy(false)
      return
    }
    const r = await createSupplierInvoice({
      supplierId: modal.row.id,
      invoiceDate: invDate,
      amountLbp: n,
      reference: invRef.trim() || undefined,
      note: invNote.trim() || undefined,
    })
    setBusy(false)
    if (r.ok) {
      const sid = modal.row.id
      toast.success(t('suppliers.toast.invoiceAdded'))
      setModal({ type: 'closed' })
      void load()
      if (historyTarget != null && historyTarget.id === sid) {
        setLedgerRefresh((n) => n + 1)
      }
    } else {
      const k = mapErr(r.error.message)
      setFormErr(k === 'generic' ? t('suppliers.errors.generic', { message: r.error.message }) : t(`suppliers.errors.${k}`))
    }
  }

  async function savePayment() {
    if (modal.type !== 'payment' || window.deken == null) {
      return
    }
    setBusy(true)
    setFormErr(null)
    const n = Math.floor(Number(payAmount))
    if (!Number.isInteger(n) || n < 1) {
      setFormErr(t('suppliers.errors.amount_invalid'))
      setBusy(false)
      return
    }
    const r = await createSupplierPayment({
      supplierId: modal.row.id,
      amountLbp: n,
      note: payNote.trim() || undefined,
    })
    setBusy(false)
    if (r.ok) {
      const sid = modal.row.id
      toast.success(t('suppliers.toast.paymentAdded'))
      setModal({ type: 'closed' })
      void load()
      if (historyTarget != null && historyTarget.id === sid) {
        setLedgerRefresh((n) => n + 1)
      }
    } else {
      const k = mapErr(r.error.message)
      setFormErr(k === 'generic' ? t('suppliers.errors.generic', { message: r.error.message }) : t(`suppliers.errors.${k}`))
    }
  }

  async function confirmDelete() {
    if (modal.type !== 'delete' || window.deken == null) {
      return
    }
    setBusy(true)
    const r = await deleteSupplier(modal.row.id)
    setBusy(false)
    if (r.ok) {
      const sid = modal.row.id
      toast.success(t('suppliers.toast.deleted'))
      setModal({ type: 'closed' })
      void load()
      if (historyTarget != null && historyTarget.id === sid) {
        setHistoryTarget(null)
      }
    } else {
      toast.error(t('suppliers.errors.generic', { message: r.error.message }))
    }
  }

  function backdropClose(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !busy) {
      setModal({ type: 'closed' })
    }
  }

  return (
    <div className="sup">
      <header className="sup__header">
        <h1 className="sup__title" id="sup-page-title">
          {t('suppliers.pageTitle')}
        </h1>
        <p className="sup__intro">{t('suppliers.intro')}</p>
      </header>

      <div className="sup__toolbar">
        <div className="sup__search">
          <input
            className="sup__search-input"
            type="search"
            placeholder={t('suppliers.toolbar.searchPlaceholder')}
            aria-label={t('suppliers.toolbar.searchAria')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sup__toolbar" style={{ gap: 'var(--space-sm)' }}>
          <label className="sup__filter">
            <span className="sup__filter-label">{t('suppliers.toolbar.balanceFilterLabel')}</span>
            <select
              className="sup__filter-select"
              value={balFilter}
              onChange={(e) => setBalFilter(e.target.value as BalFilter)}
            >
              <option value="all">{t('suppliers.toolbar.filterAll')}</option>
              <option value="owes">{t('suppliers.toolbar.filterOwes')}</option>
              <option value="zero">{t('suppliers.toolbar.filterZero')}</option>
            </select>
          </label>
          <button
            type="button"
            className="sup-btn sup-btn--primary"
            onClick={openCreate}
            disabled={window.deken == null}
          >
            <Plus size={18} strokeWidth={2} aria-hidden />
            {t('suppliers.toolbar.addSupplier')}
          </button>
        </div>
      </div>

      <section className="sup-panel" aria-labelledby="sup-table-title">
        <h2 className="sup-panel__title" id="sup-table-title">
          {t('suppliers.table.sectionTitle')}
        </h2>
        {loadError ? (
          <div className="sup-empty">
            <p>{t('suppliers.loadError')}</p>
            <button type="button" className="sup-btn sup-btn--primary" onClick={() => void load()}>
              {t('suppliers.retryLoad')}
            </button>
          </div>
        ) : (
          <div className="sup-table-wrap">
            <table className="sup-table">
              <thead>
                <tr>
                  <th scope="col">{t('suppliers.table.name')}</th>
                  <th scope="col">{t('suppliers.table.phone')}</th>
                  <th scope="col" className="sup-table__num">
                    {t('suppliers.table.balanceLbp')}
                  </th>
                  <th scope="col" className="sup-table__num">
                    {t('suppliers.table.balanceUsd')}
                  </th>
                  <th scope="col" className="sup-table__actions">
                    {t('suppliers.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="sup-empty">
                      {t('suppliers.loading')}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="sup-empty">
                      {t('suppliers.empty')}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const usd = row.balanceLbp / lbpPerUsd
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.name}</strong>
                          {row.note ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{row.note}</div>
                          ) : null}
                        </td>
                        <td>{row.phone?.trim() ? row.phone : t('suppliers.table.noPhone')}</td>
                        <td className="sup-table__num">{formatLbp(row.balanceLbp, lng)}</td>
                        <td className="sup-table__num" style={{ color: 'var(--color-muted)' }}>
                          {formatUsd(usd, lng)}
                        </td>
                        <td className="sup-table__actions">
                          <div className="sup-actions">
                            <button
                              type="button"
                              className="sup-iconbtn sup-iconbtn--history"
                              onClick={() => {
                                setHistoryTarget(row)
                              }}
                              disabled={window.deken == null}
                              title={t('suppliers.actions.viewHistory')}
                              aria-label={t('suppliers.actions.ariaViewHistory', { name: row.name })}
                            >
                              <Eye size={18} strokeWidth={2} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="sup-btn sup-btn--ghost"
                              onClick={() => openInvoice(row)}
                              disabled={window.deken == null}
                            >
                              {t('suppliers.actions.invoice')}
                            </button>
                            <button
                              type="button"
                              className="sup-btn sup-btn--ghost"
                              onClick={() => openPayment(row)}
                              disabled={window.deken == null}
                            >
                              {t('suppliers.actions.payment')}
                            </button>
                            <button
                              type="button"
                              className="sup-btn sup-btn--ghost"
                              onClick={() => openEdit(row)}
                              disabled={window.deken == null}
                            >
                              {t('suppliers.actions.edit')}
                            </button>
                            <button
                              type="button"
                              className="sup-btn sup-btn--ghost"
                              onClick={() => setModal({ type: 'delete', row })}
                              disabled={window.deken == null}
                            >
                              {t('suppliers.actions.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {historyTarget != null ? (
        <SupplierHistoryDialog
          row={historyTarget}
          refreshTrigger={ledgerRefresh}
          onClose={() => {
            setHistoryTarget(null)
          }}
        />
      ) : null}

      {modal.type !== 'closed' ? (
        <div className="sup-dim" role="presentation" onClick={backdropClose}>
          <div
            className="sup-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dlgTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            {modal.type === 'create' || modal.type === 'edit' ? (
              <>
                <h2 className="sup-dialog__title" id={dlgTitleId}>
                  {modal.type === 'create' ? t('suppliers.form.createTitle') : t('suppliers.form.editTitle')}
                </h2>
                {formErr ? <p className="sup-dialog__err">{formErr}</p> : null}
                <label className="sup-field">
                  <span className="sup-field__label">{t('suppliers.form.name')}</span>
                  <input
                    className="sup-field__input"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    disabled={busy}
                    autoComplete="organization"
                  />
                </label>
                <label className="sup-field">
                  <span className="sup-field__label">{t('suppliers.form.phone')}</span>
                  <input
                    className="sup-field__input"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="sup-field">
                  <span className="sup-field__label">{t('suppliers.form.note')}</span>
                  <textarea
                    className="sup-field__textarea"
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <div className="sup-dialog__actions">
                  <button type="button" className="sup-btn sup-btn--ghost" onClick={() => setModal({ type: 'closed' })} disabled={busy}>
                    {t('suppliers.form.cancel')}
                  </button>
                  <button type="button" className="sup-btn sup-btn--primary" onClick={() => void saveSupplier()} disabled={busy}>
                    {busy ? t('suppliers.form.saving') : t('suppliers.form.save')}
                  </button>
                </div>
              </>
            ) : null}

            {modal.type === 'invoice' ? (
              <>
                <h2 className="sup-dialog__title" id={dlgTitleId}>
                  {t('suppliers.invoice.title', { name: modal.row.name })}
                </h2>
                {formErr ? <p className="sup-dialog__err">{formErr}</p> : null}
                <label className="sup-field">
                  <span className="sup-field__label">{t('suppliers.invoice.date')}</span>
                  <input
                    className="sup-field__input"
                    type="date"
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="sup-field">
                  <span className="sup-field__label">{t('suppliers.invoice.amount')}</span>
                  <input
                    className="sup-field__input"
                    type="text"
                    inputMode="numeric"
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="sup-field">
                  <span className="sup-field__label">{t('suppliers.invoice.reference')}</span>
                  <input
                    className="sup-field__input"
                    value={invRef}
                    onChange={(e) => setInvRef(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="sup-field">
                  <span className="sup-field__label">{t('suppliers.invoice.note')}</span>
                  <textarea
                    className="sup-field__textarea"
                    value={invNote}
                    onChange={(e) => setInvNote(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <div className="sup-dialog__actions">
                  <button type="button" className="sup-btn sup-btn--ghost" onClick={() => setModal({ type: 'closed' })} disabled={busy}>
                    {t('suppliers.form.cancel')}
                  </button>
                  <button type="button" className="sup-btn sup-btn--primary" onClick={() => void saveInvoice()} disabled={busy}>
                    {busy ? t('suppliers.form.saving') : t('suppliers.invoice.submit')}
                  </button>
                </div>
              </>
            ) : null}

            {modal.type === 'payment' ? (
              <>
                <h2 className="sup-dialog__title" id={dlgTitleId}>
                  {t('suppliers.payment.title', { name: modal.row.name })}
                </h2>
                {formErr ? <p className="sup-dialog__err">{formErr}</p> : null}
                <label className="sup-field">
                  <span className="sup-field__label">{t('suppliers.payment.amount')}</span>
                  <input
                    className="sup-field__input"
                    type="text"
                    inputMode="numeric"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="sup-field">
                  <span className="sup-field__label">{t('suppliers.payment.note')}</span>
                  <textarea
                    className="sup-field__textarea"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <div className="sup-dialog__actions">
                  <button type="button" className="sup-btn sup-btn--ghost" onClick={() => setModal({ type: 'closed' })} disabled={busy}>
                    {t('suppliers.form.cancel')}
                  </button>
                  <button type="button" className="sup-btn sup-btn--primary" onClick={() => void savePayment()} disabled={busy}>
                    {busy ? t('suppliers.form.saving') : t('suppliers.payment.submit')}
                  </button>
                </div>
              </>
            ) : null}

            {modal.type === 'delete' ? (
              <>
                <h2 className="sup-dialog__title" id={dlgTitleId}>
                  {t('suppliers.delete.title')}
                </h2>
                <p>{t('suppliers.delete.body', { name: modal.row.name })}</p>
                <div className="sup-dialog__actions">
                  <button type="button" className="sup-btn sup-btn--ghost" onClick={() => setModal({ type: 'closed' })} disabled={busy}>
                    {t('suppliers.form.cancel')}
                  </button>
                  <button type="button" className="sup-btn sup-btn--primary" onClick={() => void confirmDelete()} disabled={busy}>
                    {busy ? t('suppliers.form.saving') : t('suppliers.delete.confirm')}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
