import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CategoryDto } from '../../../../shared/ipc/types'
import { useToast } from '../../components/toast'
import {
  bulkImportFlavors,
  bulkImportSizes,
} from '../../lib/api/dekenClient'
import { downloadAsCsvFile, fileDateStamp, toCsvLine } from '../../lib/csvExport'
import { parseCsv } from '../../lib/csvImport'
import './ProductFormDialog.css'
import './DeleteProductDialog.css'
import './ProductsPage.css'

type LinkedRow = {
  id: string
  categoryId: string
  name: string
  createdAt: string
  updatedAt: string
}

type Kind = 'sizes' | 'flavors'

type Props = {
  kind: Kind
  categories: CategoryDto[]
  onChanged: () => void
  listRows: () => Promise<{ ok: true; data: LinkedRow[] } | { ok: false; error: { message: string } }>
  createRow: (input: { categoryId: string; name: string }) => Promise<{ ok: boolean; error?: { message: string } }>
  updateRow: (
    id: string,
    input: { categoryId?: string; name?: string },
  ) => Promise<{ ok: boolean; error?: { message: string } }>
  deleteRow: (id: string) => Promise<{ ok: boolean; error?: { message: string } }>
}

type FormMode = { type: 'closed' } | { type: 'create' } | { type: 'edit'; row: LinkedRow }

function mapIpcErrorKey(message: string): string {
  const m = message.trim()
  if (m === 'name_required' || m === 'id_required' || m === 'category_required' || m === 'category_not_found') {
    return m
  }
  if (m === 'name_taken' || m === 'size_in_use' || m === 'flavor_in_use') {
    return m
  }
  if (m.toLowerCase().includes('unique') || m.includes('UNIQUE')) return 'name_taken'
  return 'generic'
}

export function CategoryLinkedOptionsPanel({
  kind,
  categories,
  onChanged,
  listRows,
  createRow,
  updateRow,
  deleteRow,
}: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const [rows, setRows] = useState<LinkedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>({ type: 'closed' })
  const [deleting, setDeleting] = useState<LinkedRow | null>(null)
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const trBase = kind === 'sizes' ? 'productSizes' : 'productFlavors'

  const refresh = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    const r = await listRows()
    setLoading(false)
    if (r.ok) setRows(r.data)
    else setLoadError(r.error.message)
  }, [listRows])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (formMode.type === 'closed') return
    if (formMode.type === 'create') {
      setName('')
      setCategoryId('')
    } else {
      setName(formMode.row.name)
      setCategoryId(formMode.row.categoryId)
    }
  }, [formMode])

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  function resolveError(key: string, raw: string): string {
    if (key === 'generic') return t(`${trBase}.errors.generic`, { message: raw })
    return t(`${trBase}.errors.${key}`)
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormBusy(true)
    const payload = { categoryId, name: name.trim() }
    try {
      if (formMode.type === 'create') {
        const r = await createRow(payload)
        if (r.ok) {
          setFormMode({ type: 'closed' })
          await refresh()
          onChanged()
          toast.success(t(`${trBase}.toast.added`))
        } else {
          setFormError(resolveError(mapIpcErrorKey(r.error?.message ?? ''), r.error?.message ?? ''))
        }
      } else if (formMode.type === 'edit') {
        const r = await updateRow(formMode.row.id, payload)
        if (r.ok) {
          setFormMode({ type: 'closed' })
          await refresh()
          onChanged()
          toast.success(t(`${trBase}.toast.updated`))
        } else {
          setFormError(resolveError(mapIpcErrorKey(r.error?.message ?? ''), r.error?.message ?? ''))
        }
      }
    } finally {
      setFormBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setFormBusy(true)
    const target = deleting
    const r = await deleteRow(target.id)
    setFormBusy(false)
    if (r.ok) {
      setDeleting(null)
      await refresh()
      onChanged()
      toast.warning(t(`${trBase}.toast.deleted`, { name: target.name }))
    } else {
      setFormError(resolveError(mapIpcErrorKey(r.error?.message ?? ''), r.error?.message ?? ''))
    }
  }

  function runExport() {
    if (rows.length === 0) {
      toast.warning(t('common.exportEmpty'))
      return
    }
    const header = toCsvLine(['id', 'categoryId', 'categoryName', 'name', 'createdAt', 'updatedAt'])
    const body = rows.map((r) =>
      toCsvLine([r.id, r.categoryId, categoryMap.get(r.categoryId) ?? '', r.name, r.createdAt, r.updatedAt]),
    )
    downloadAsCsvFile(`deken-${kind}-${fileDateStamp()}`, [header, ...body])
    toast.success(t('common.exportToast'))
  }

  function triggerImport() {
    fileInputRef.current?.click()
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = evt.target?.result
      if (typeof text !== 'string') return

      try {
        const rowsParsed = parseCsv(text)
        if (rowsParsed.length < 2) {
          toast.error(t('common.importInvalidFormat'))
          return
        }

        const bodyRows = rowsParsed.slice(1)
        // Expected CSV: categoryName, name
        // We'll try to find categoryId by name
        const inputs: { categoryId: string; name: string }[] = []
        
        for (const row of bodyRows) {
          const catName = row[0]?.trim()
          const itemName = row[1]?.trim()
          if (!catName || !itemName) continue

          const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
          if (cat) {
            inputs.push({ categoryId: cat.id, name: itemName })
          }
        }

        if (inputs.length === 0) {
          toast.warning(t('common.exportEmpty'))
          return
        }

        setLoading(true)
        const res = kind === 'sizes' 
          ? await bulkImportSizes(inputs)
          : await bulkImportFlavors(inputs)
        setLoading(false)

        if (res.ok) {
          toast.success(t('common.importToast', { count: res.data.imported }))
          void refresh()
          onChanged()
        } else {
          toast.error(t('common.importError', { message: res.error.message }))
        }
      } catch (err) {
        setLoading(false)
        toast.error(t('common.importError', { message: String(err) }))
      }
    }
    reader.readAsText(file)
  }

  return (
    <section className="prod-panel">
      <div className="prod-panel__head prod-categories__head">
        <h2 className="prod-panel__title">{t(`${trBase}.sectionTitle`)}</h2>
        <div className="prod-categories__head-actions">
          <button type="button" className="prod-btn prod-btn--ghost" onClick={runExport} disabled={loading || rows.length === 0}>
            <Download size={18} strokeWidth={2} aria-hidden />
            {t('common.export')}
          </button>
          <button
            type="button"
            className="prod-btn prod-btn--ghost"
            onClick={triggerImport}
            disabled={loading}
            title={t('common.importAria')}
            aria-label={t('common.importAria')}
          >
            <Upload size={18} strokeWidth={2} aria-hidden />
            {t('common.import')}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".csv,text/csv"
            onChange={handleImport}
          />
          <button type="button" className="prod-btn prod-btn--primary" onClick={() => setFormMode({ type: 'create' })}>
            <Plus size={18} strokeWidth={2} aria-hidden />
            {t(`${trBase}.actions.add`)}
          </button>
        </div>
      </div>
      {loadError ? <p className="prod-banner prod-banner--error">{t(`${trBase}.loadError`, { message: loadError })}</p> : null}
      {formError ? <p className="prod-banner prod-banner--error">{formError}</p> : null}

      <div className="prod-table-wrap" aria-busy={loading || undefined}>
        <table className="prod-table">
          <thead>
            <tr>
              <th>{t('products.table.category')}</th>
              <th>{t(`${trBase}.table.name`)}</th>
              <th>
                <span className="prod-visually-hidden">{t('products.table.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="prod-table__cell-muted">{t('products.table.loadingRow')}</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="prod-table__cell-muted">{t(`${trBase}.emptyBody`)}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{categoryMap.get(row.categoryId) ?? t('common.emDash')}</td>
                  <td>{row.name}</td>
                  <td className="prod-table__actions">
                    <div className="prod-table__action-btns">
                      <button type="button" className="prod-iconbtn" onClick={() => setFormMode({ type: 'edit', row })}>
                        <Pencil size={17} strokeWidth={2} aria-hidden />
                      </button>
                      <button type="button" className="prod-iconbtn prod-iconbtn--danger" onClick={() => setDeleting(row)}>
                        <Trash2 size={17} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formMode.type !== 'closed' ? (
        <div className="pf-dim" role="presentation" onClick={(e) => (e.target === e.currentTarget ? setFormMode({ type: 'closed' }) : undefined)}>
          <div className="pf-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="pf-dialog__title">
              {formMode.type === 'edit' ? t(`${trBase}.form.titleEdit`) : t(`${trBase}.form.titleCreate`)}
            </h3>
            <form className="pf-form" onSubmit={submitForm}>
              <div className="pf-field">
                <label htmlFor={`${kind}-cat`}>{t('products.form.category')}</label>
                <select id={`${kind}-cat`} className="pf-input pf-input--select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                  <option value="">{t(`${trBase}.form.categoryPlaceholder`)}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="pf-field">
                <label htmlFor={`${kind}-name`}>{t(`${trBase}.form.name`)}</label>
                <input id={`${kind}-name`} className="pf-input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </div>
              <div className="pf-actions">
                <button type="button" className="pf-btn pf-btn--ghost" disabled={formBusy} onClick={() => setFormMode({ type: 'closed' })}>{t('products.form.cancel')}</button>
                <button type="submit" className="pf-btn pf-btn--primary" disabled={formBusy}>
                  {formMode.type === 'edit' ? t('products.form.save') : t(`${trBase}.form.add`)}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleting ? (
        <div className="pdel-dim" role="presentation" onClick={(e) => (e.target === e.currentTarget && !formBusy ? setDeleting(null) : undefined)}>
          <div className="pdel-dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="pdel-dialog__title">{t(`${trBase}.delete.title`)}</h3>
            <p className="pdel-dialog__body">{t(`${trBase}.delete.confirm`, { name: deleting.name })}</p>
            <div className="pdel-dialog__actions">
              <button type="button" className="pdel-btn pdel-btn--ghost" disabled={formBusy} onClick={() => setDeleting(null)}>
                {t('products.form.cancel')}
              </button>
              <button type="button" className="pdel-btn pdel-btn--danger" disabled={formBusy} onClick={() => { void confirmDelete() }}>
                {t('products.actions.delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
