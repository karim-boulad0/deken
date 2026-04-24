import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CategoryDto } from '../../../../shared/ipc/types'
import { useToast } from '../../components/toast'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../../lib/api/dekenClient'
import { CategoryFormDialog } from './CategoryFormDialog'
import { DeleteCategoryDialog } from './DeleteCategoryDialog'
import './ProductsPage.css'

type FormMode = { type: 'closed' } | { type: 'create' } | { type: 'edit'; category: CategoryDto }

function mapIpcErrorKey(message: string): string {
  const m = message.trim()
  if (m === 'name_required' || m === 'id_required') {
    return m
  }
  if (m === 'name_taken' || m === 'category_in_use') {
    return m
  }
  if (m.toLowerCase().includes('unique') || m.includes('UNIQUE')) {
    return 'name_taken'
  }
  return 'generic'
}

type Props = {
  onCategoriesChanged: () => void
}

export function ProductCategoriesPanel({ onCategoriesChanged }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const [rows, setRows] = useState<CategoryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode>({ type: 'closed' })
  const [formBusy, setFormBusy] = useState(false)
  const [deleting, setDeleting] = useState<CategoryDto | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    const r = await listCategories()
    setLoading(false)
    if (r.ok) {
      setRows(r.data)
    } else {
      setLoadError(r.error.message)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function resolveErrorKey(k: string, raw: string) {
    if (k === 'generic') {
      return t('productCategories.errors.generic', { message: raw })
    }
    return t(`productCategories.errors.${k}`)
  }

  async function onFormSave(
    payload: { create: { name: string } } | { id: string; name: string },
  ) {
    setFormError(null)
    setFormBusy(true)
    try {
      if ('create' in payload) {
        const r = await createCategory(payload.create)
        if (r.ok) {
          setFormMode({ type: 'closed' })
          onCategoriesChanged()
          await refresh()
          toast.success(t('productCategories.toast.added'))
        } else {
          setFormError(resolveErrorKey(mapIpcErrorKey(r.error.message), r.error.message))
        }
      } else {
        const r = await updateCategory(payload.id, { name: payload.name })
        if (r.ok) {
          setFormMode({ type: 'closed' })
          onCategoriesChanged()
          await refresh()
          toast.success(t('productCategories.toast.updated'))
        } else {
          setFormError(resolveErrorKey(mapIpcErrorKey(r.error.message), r.error.message))
        }
      }
    } finally {
      setFormBusy(false)
    }
  }

  async function doDelete() {
    if (deleting == null) {
      return
    }
    const c = deleting
    setFormBusy(true)
    setDeletingId(c.id)
    setFormError(null)
    const r = await deleteCategory(c.id)
    setDeletingId(null)
    if (r.ok) {
      setDeleting(null)
      onCategoriesChanged()
      await refresh()
      toast.warning(t('productCategories.toast.deleted', { name: c.name }))
    } else {
      setFormError(resolveErrorKey(mapIpcErrorKey(r.error.message), r.error.message))
    }
    setFormBusy(false)
  }

  const showEmpty = !loading && rows.length === 0

  return (
    <section
      className="prod-panel"
      aria-labelledby="prod-categories-title"
    >
      <div className="prod-panel__head prod-categories__head">
        <h2 className="prod-panel__title" id="prod-categories-title">
          {t('productCategories.sectionTitle')}
        </h2>
        <button
          type="button"
          className="prod-btn prod-btn--primary"
          onClick={() => {
            setFormError(null)
            setFormMode({ type: 'create' })
          }}
        >
          <Plus size={18} strokeWidth={2} aria-hidden />
          {t('productCategories.actions.add')}
        </button>
      </div>

      {loadError ? (
        <p className="prod-banner prod-banner--error" role="alert">
          {t('productCategories.loadError', { message: loadError })}
        </p>
      ) : null}

      {formError ? (
        <p className="prod-banner prod-banner--error" role="alert">
          {formError}
        </p>
      ) : null}

      {showEmpty ? (
        <div className="prod-empty" role="status">
          <p className="prod-empty__title">{t('productCategories.emptyTitle')}</p>
          <p className="prod-empty__body">{t('productCategories.emptyBody')}</p>
        </div>
      ) : null}

      {!showEmpty && !loadError ? (
        <div className="prod-table-wrap" aria-busy={loading || undefined}>
          <table className="prod-table">
            <colgroup>
              <col className="prod-categories__col-name" />
              <col className="prod-table__col-actions" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{t('productCategories.table.name')}</th>
                <th scope="col">
                  <span className="prod-visually-hidden">{t('products.table.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} className="prod-table__cell-muted">
                    {t('products.table.loadingRow')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="prod-table__cell-truncate">
                      <span className="prod-table__ellipsis" title={row.name}>
                        {row.name}
                      </span>
                    </td>
                    <td className="prod-table__actions">
                      <div className="prod-table__action-btns">
                        <button
                          type="button"
                          className="prod-iconbtn"
                          title={t('products.actions.edit')}
                          aria-label={t('products.actions.edit')}
                          disabled={deletingId != null}
                          onClick={() => {
                            setFormError(null)
                            setFormMode({ type: 'edit', category: row })
                          }}
                        >
                          <Pencil size={17} strokeWidth={2} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="prod-iconbtn prod-iconbtn--danger"
                          title={t('products.actions.delete')}
                          aria-label={t('products.actions.delete')}
                          disabled={deletingId != null}
                          onClick={() => {
                            setFormError(null)
                            setDeleting(row)
                          }}
                        >
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
      ) : null}

      {formMode.type === 'create' || formMode.type === 'edit' ? (
        <CategoryFormDialog
          open
          mode={formMode}
          onOpenChange={(o) => {
            if (!o) {
              setFormError(null)
              setFormMode({ type: 'closed' })
            }
          }}
          onSave={(p) => {
            void onFormSave(p)
          }}
          busy={formBusy}
        />
      ) : null}

      {deleting ? (
        <DeleteCategoryDialog
          category={deleting}
          busy={deletingId != null}
          onCancel={() => {
            if (deletingId == null) {
              setDeleting(null)
            }
          }}
          onConfirm={() => {
            void doDelete()
          }}
        />
      ) : null}
    </section>
  )
}
