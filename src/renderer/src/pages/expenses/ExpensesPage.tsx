import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/toast'
import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
  deleteExpenseCategory,
  getExpenseTotalInRange,
  listExpenseCategories,
  listExpensesInRange,
  updateExpense,
  updateExpenseCategory,
} from '../../lib/api/dekenClient'
import { rangeForPreset } from '../../lib/reportDateRange'
import { formatLbp } from '../pos/formatPos'
import type { ExpenseCategoryDto, ExpenseDto } from '../../../../shared/ipc/types'
import './ExpensesPage.css'

function localIsoFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}

function mapErr(m: string): string {
  const s = m.trim()
  if (
    s === 'name_required' ||
    s === 'not_found' ||
    s === 'category_in_use' ||
    s === 'amount_invalid' ||
    s === 'invalid_date_range' ||
    s === 'name_too_long' ||
    s === 'note_too_long'
  ) {
    return s
  }
  return 'generic'
}

export function ExpensesPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const lng = i18n.language
  const loc = lng.startsWith('ar') ? 'ar-LB' : 'en-US'
  const [tab, setTab] = useState<'categories' | 'ledger'>('ledger')
  const [categories, setCategories] = useState<ExpenseCategoryDto[]>([])
  const [expenses, setExpenses] = useState<ExpenseDto[]>([])
  const [totalLbp, setTotalLbp] = useState(0)
  const [fromDate, setFromDate] = useState(() => rangeForPreset('week').fromDate)
  const [toDate, setToDate] = useState(() => rangeForPreset('week').toDate)
  const [loading, setLoading] = useState(true)
  const [catBusy, setCatBusy] = useState(false)

  const [modal, setModal] = useState<
    | { type: 'closed' }
    | { type: 'cat-create' }
    | { type: 'cat-edit'; cat: ExpenseCategoryDto }
    | { type: 'exp-create' }
    | { type: 'exp-edit'; exp: ExpenseDto }
  >({ type: 'closed' })
  const [catName, setCatName] = useState('')
  const [expCatId, setExpCatId] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expSpentAt, setExpSpentAt] = useState(() => rangeForPreset('week').toDate)
  const [expNote, setExpNote] = useState('')
  const [expCash, setExpCash] = useState(true)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dlgId = useId()

  const reload = useCallback(async () => {
    setLoading(true)
    const cr = await listExpenseCategories()
    if (cr.ok) {
      setCategories(cr.data)
      setExpCatId((p) => (p === '' && cr.data[0] ? cr.data[0].id : p))
    }
    const lr = await listExpensesInRange({ fromDate, toDate })
    const tr = await getExpenseTotalInRange({ fromDate, toDate })
    if (lr.ok) {
      setExpenses(lr.data)
    }
    if (tr.ok) {
      setTotalLbp(tr.data.totalLbp)
    }
    setLoading(false)
  }, [fromDate, toDate])

  useEffect(() => {
    void reload()
  }, [reload])

  async function saveCategory() {
    if (window.deken == null) {
      return
    }
    setBusy(true)
    setFormErr(null)
    const name = catName.trim()
    if (name.length === 0) {
      setFormErr(t('expenses.errors.name_required'))
      setBusy(false)
      return
    }
    if (modal.type === 'cat-create') {
      const r = await createExpenseCategory({ name })
      setBusy(false)
      if (r.ok) {
        toast.success(t('expenses.categories.toastAdded'))
        setModal({ type: 'closed' })
        void reload()
      } else {
        const k = mapErr(r.error.message)
        setFormErr(k === 'generic' ? t('expenses.errors.generic', { message: r.error.message }) : t(`expenses.errors.${k}`))
      }
    } else if (modal.type === 'cat-edit') {
      const r = await updateExpenseCategory(modal.cat.id, { name })
      setBusy(false)
      if (r.ok) {
        toast.success(t('expenses.categories.toastUpdated'))
        setModal({ type: 'closed' })
        void reload()
      } else {
        const k = mapErr(r.error.message)
        setFormErr(k === 'generic' ? t('expenses.errors.generic', { message: r.error.message }) : t(`expenses.errors.${k}`))
      }
    }
  }

  async function delCategory(c: ExpenseCategoryDto) {
    if (window.deken == null || !confirm(t('expenses.categories.confirmDelete', { name: c.name }))) {
      return
    }
    setCatBusy(true)
    const r = await deleteExpenseCategory(c.id)
    setCatBusy(false)
    if (r.ok) {
      toast.success(t('expenses.categories.toastDeleted'))
      void reload()
    } else {
      const k = mapErr(r.error.message)
      toast.error(k === 'generic' ? t('expenses.errors.generic', { message: r.error.message }) : t(`expenses.errors.${k}`))
    }
  }

  async function saveExpense() {
    if (window.deken == null) {
      return
    }
    setBusy(true)
    setFormErr(null)
    const n = Math.floor(Number(expAmount))
    if (!Number.isInteger(n) || n < 1) {
      setFormErr(t('expenses.errors.amount_invalid'))
      setBusy(false)
      return
    }
    const spentAt = localIsoFromYmd(expSpentAt.trim() || rangeForPreset('week').toDate)
    if (modal.type === 'exp-create') {
      const r = await createExpense({
        categoryId: expCatId,
        amountLbp: n,
        spentAt,
        note: expNote.trim() || undefined,
        paidFromCash: expCash,
      })
      setBusy(false)
      if (r.ok) {
        toast.success(t('expenses.ledger.toastAdded'))
        setModal({ type: 'closed' })
        void reload()
      } else {
        const k = mapErr(r.error.message)
        setFormErr(k === 'generic' ? t('expenses.errors.generic', { message: r.error.message }) : t(`expenses.errors.${k}`))
      }
    } else if (modal.type === 'exp-edit') {
      const r = await updateExpense(modal.exp.id, {
        categoryId: expCatId,
        amountLbp: n,
        spentAt,
        note: expNote.trim() || null,
        paidFromCash: expCash,
      })
      setBusy(false)
      if (r.ok) {
        toast.success(t('expenses.ledger.toastUpdated'))
        setModal({ type: 'closed' })
        void reload()
      } else {
        const k = mapErr(r.error.message)
        setFormErr(k === 'generic' ? t('expenses.errors.generic', { message: r.error.message }) : t(`expenses.errors.${k}`))
      }
    }
  }

  async function delExpense(e: ExpenseDto) {
    if (window.deken == null || !confirm(t('expenses.ledger.confirmDelete'))) {
      return
    }
    const r = await deleteExpense(e.id)
    if (r.ok) {
      toast.success(t('expenses.ledger.toastDeleted'))
      void reload()
    } else {
      toast.error(t('expenses.errors.generic', { message: r.error.message }))
    }
  }

  function openCreateExpense() {
    setFormErr(null)
    setExpAmount('')
    setExpSpentToToday()
    setExpNote('')
    setExpCash(true)
    if (categories[0]) {
      setExpCatId(categories[0].id)
    }
    setModal({ type: 'exp-create' })
  }

  function setExpSpentToToday() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setExpSpentAt(`${y}-${m}-${day}`)
  }

  function openEditExpense(e: ExpenseDto) {
    setFormErr(null)
    setExpCatId(e.categoryId)
    setExpAmount(String(e.amountLbp))
    const d = new Date(e.spentAt)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setExpSpentAt(`${y}-${m}-${day}`)
    setExpNote(e.note ?? '')
    setExpCash(e.paidFromCash)
    setModal({ type: 'exp-edit', exp: e })
  }

  return (
    <div className="exp">
      <header className="exp__header">
        <h1 className="exp__title">{t('expenses.pageTitle')}</h1>
        <p className="exp__intro">{t('expenses.intro')}</p>
      </header>

      <div className="exp__tabs" role="tablist">
        <button
          type="button"
          className="exp__tab"
          role="tab"
          aria-selected={tab === 'ledger'}
          onClick={() => setTab('ledger')}
        >
          {t('expenses.tabs.ledger')}
        </button>
        <button
          type="button"
          className="exp__tab"
          role="tab"
          aria-selected={tab === 'categories'}
          onClick={() => setTab('categories')}
        >
          {t('expenses.tabs.categories')}
        </button>
      </div>

      {tab === 'categories' ? (
        <section className="exp-panel" aria-labelledby="exp-cat-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h2 className="exp__title" style={{ fontSize: '1rem' }} id="exp-cat-title">
              {t('expenses.categories.title')}
            </h2>
            <button
              type="button"
              className="exp-btn exp-btn--primary"
              onClick={() => {
                setCatName('')
                setFormErr(null)
                setModal({ type: 'cat-create' })
              }}
              disabled={window.deken == null || catBusy}
            >
              <Plus size={16} aria-hidden />
              {t('expenses.categories.add')}
            </button>
          </div>
          {categories.map((c) => (
            <div key={c.id} className="exp-cat-row">
              <span>{c.name}</span>
              <span>
                <button
                  type="button"
                  className="exp-btn exp-btn--ghost"
                  aria-label={t('expenses.categories.edit')}
                  onClick={() => {
                    setCatName(c.name)
                    setFormErr(null)
                    setModal({ type: 'cat-edit', cat: c })
                  }}
                  disabled={catBusy || window.deken == null}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="exp-btn exp-btn--ghost"
                  aria-label={t('expenses.categories.delete')}
                  onClick={() => void delCategory(c)}
                  disabled={catBusy || window.deken == null}
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))}
          {categories.length === 0 && !loading ? (
            <p style={{ color: 'var(--color-muted)' }}>{t('expenses.categories.empty')}</p>
          ) : null}
        </section>
      ) : (
        <section className="exp-panel">
          <div className="exp-toolbar">
            <label className="exp-field">
              <span className="exp-field__label">{t('expenses.ledger.from')}</span>
              <input
                className="exp-field__input"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label className="exp-field">
              <span className="exp-field__label">{t('expenses.ledger.to')}</span>
              <input
                className="exp-field__input"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="exp-btn exp-btn--primary"
              onClick={openCreateExpense}
              disabled={window.deken == null || categories.length === 0}
            >
              {t('expenses.ledger.add')}
            </button>
          </div>
          <p className="exp-summary">
            {t('expenses.ledger.total', { n: formatLbp(totalLbp, lng) })}
          </p>
          <div className="exp-table-wrap">
            <table className="exp-table">
              <thead>
                <tr>
                  <th>{t('expenses.ledger.colDate')}</th>
                  <th>{t('expenses.ledger.colCategory')}</th>
                  <th className="exp-table__num">{t('expenses.ledger.colAmount')}</th>
                  <th>{t('expenses.ledger.colNote')}</th>
                  <th>{t('expenses.ledger.colCash')}</th>
                  <th>{t('expenses.ledger.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6}>{t('expenses.loading')}</td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{t('expenses.ledger.empty')}</td>
                  </tr>
                ) : (
                  expenses.map((e) => {
                    const d = new Date(e.spentAt)
                    return (
                      <tr key={e.id}>
                        <td>{d.toLocaleDateString(loc)}</td>
                        <td>{e.categoryName}</td>
                        <td className="exp-table__num">{formatLbp(e.amountLbp, lng)}</td>
                        <td>{e.note ?? '—'}</td>
                        <td>{e.paidFromCash ? t('expenses.ledger.yes') : t('expenses.ledger.no')}</td>
                        <td>
                          <button type="button" className="exp-btn exp-btn--ghost" onClick={() => openEditExpense(e)}>
                            {t('expenses.ledger.edit')}
                          </button>
                          <button type="button" className="exp-btn exp-btn--ghost" onClick={() => void delExpense(e)}>
                            {t('expenses.ledger.delete')}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modal.type !== 'closed' ? (
        <div
          className="exp-dim"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setModal({ type: 'closed' })
            }
          }}
        >
          <div className="exp-dialog" role="dialog" aria-modal="true" aria-labelledby={dlgId} onClick={(ev) => ev.stopPropagation()}>
            {modal.type === 'cat-create' || modal.type === 'cat-edit' ? (
              <>
                <h2 className="exp-dialog__title" id={dlgId}>
                  {modal.type === 'cat-create' ? t('expenses.categories.createTitle') : t('expenses.categories.editTitle')}
                </h2>
                {formErr ? <p className="exp-dialog__err">{formErr}</p> : null}
                <label className="exp-field">
                  <span className="exp-field__label">{t('expenses.categories.name')}</span>
                  <input className="exp-field__input" value={catName} onChange={(e) => setCatName(e.target.value)} disabled={busy} />
                </label>
                <div className="exp-dialog__actions">
                  <button type="button" className="exp-btn exp-btn--ghost" onClick={() => setModal({ type: 'closed' })} disabled={busy}>
                    {t('expenses.form.cancel')}
                  </button>
                  <button type="button" className="exp-btn exp-btn--primary" onClick={() => void saveCategory()} disabled={busy}>
                    {busy ? t('expenses.form.saving') : t('expenses.form.save')}
                  </button>
                </div>
              </>
            ) : null}

            {modal.type === 'exp-create' || modal.type === 'exp-edit' ? (
              <>
                <h2 className="exp-dialog__title" id={dlgId}>
                  {modal.type === 'exp-create' ? t('expenses.ledger.createTitle') : t('expenses.ledger.editTitle')}
                </h2>
                {formErr ? <p className="exp-dialog__err">{formErr}</p> : null}
                <label className="exp-field">
                  <span className="exp-field__label">{t('expenses.ledger.colCategory')}</span>
                  <select
                    className="exp-field__input"
                    value={expCatId}
                    onChange={(e) => setExpCatId(e.target.value)}
                    disabled={busy}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="exp-field">
                  <span className="exp-field__label">{t('expenses.ledger.colAmount')}</span>
                  <input
                    className="exp-field__input"
                    type="text"
                    inputMode="numeric"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="exp-field">
                  <span className="exp-field__label">{t('expenses.ledger.colDate')}</span>
                  <input
                    className="exp-field__input"
                    type="date"
                    value={expSpentAt}
                    onChange={(e) => setExpSpentAt(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="exp-field">
                  <span className="exp-field__label">{t('expenses.ledger.colNote')}</span>
                  <input className="exp-field__input" value={expNote} onChange={(e) => setExpNote(e.target.value)} disabled={busy} />
                </label>
                <label className="exp-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={expCash} onChange={(e) => setExpCash(e.target.checked)} disabled={busy} />
                  <span>{t('expenses.ledger.paidFromCash')}</span>
                </label>
                <div className="exp-dialog__actions">
                  <button type="button" className="exp-btn exp-btn--ghost" onClick={() => setModal({ type: 'closed' })} disabled={busy}>
                    {t('expenses.form.cancel')}
                  </button>
                  <button type="button" className="exp-btn exp-btn--primary" onClick={() => void saveExpense()} disabled={busy}>
                    {busy ? t('expenses.form.saving') : t('expenses.form.save')}
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
