import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CreateProductInput, ProductDto, UpdateProductInput } from '../../../../shared/ipc/types'
import { useToast } from '../../components/toast'
import { createProduct, deleteProduct, listProducts, updateProduct } from '../../lib/api/dekenClient'
import { formatLbp } from '../pos/formatPos'
import { DeleteProductDialog } from './DeleteProductDialog'
import { ProductFormDialog } from './ProductFormDialog'
import './ProductsPage.css'

type FormMode = { type: 'closed' } | { type: 'create' } | { type: 'edit'; product: ProductDto }

function mapIpcErrorKey(message: string): string {
  const m = message.trim()
  if (m === 'sku_required' || m === 'name_required' || m === 'id_required') {
    return m
  }
  if (m === 'price_invalid' || m === 'stock_invalid') {
    return m
  }
  if (m.toLowerCase().includes('unique') || m.includes('UNIQUE')) {
    return 'sku_taken'
  }
  return 'generic'
}

export function ProductsPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const lng = i18n.language
  const [query, setQuery] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [rows, setRows] = useState<ProductDto[]>([])
  const [loading, setLoading] = useState(true)
  const [formBusy, setFormBusy] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>({ type: 'closed' })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductDto | null>(null)

  useEffect(() => {
    const tmr = window.setTimeout(() => setSearchDebounced(query), 200)
    return () => window.clearTimeout(tmr)
  }, [query])

  const refresh = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    const res = await listProducts(searchDebounced)
    setLoading(false)
    if (res.ok) {
      setRows(res.data)
    } else {
      setLoadError(res.error.message)
    }
  }, [searchDebounced])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = useMemo(() => rows, [rows])

  const showEmpty = query.trim().length > 0 && filtered.length === 0
  const showCatalogEmpty = query.trim() === '' && !loading && filtered.length === 0

  async function onFormSave(
    payload: { create: CreateProductInput } | { id: string; input: UpdateProductInput },
  ) {
    setFormError(null)
    setFormBusy(true)
    try {
      if ('create' in payload) {
        const r = await createProduct(payload.create)
        if (r.ok) {
          setFormMode({ type: 'closed' })
          await refresh()
          setFormError(null)
          toast.success(t('products.toast.added'))
        } else {
          const k = mapIpcErrorKey(r.error.message)
          setFormError(
            k === 'generic'
              ? t('products.errors.generic', { message: r.error.message })
              : t(`products.errors.${k}`),
          )
        }
      } else {
        const r = await updateProduct(payload.id, payload.input)
        if (r.ok) {
          setFormMode({ type: 'closed' })
          await refresh()
          setFormError(null)
          toast.success(t('products.toast.updated'))
        } else {
          const k = mapIpcErrorKey(r.error.message)
          setFormError(
            k === 'generic'
              ? t('products.errors.generic', { message: r.error.message })
              : t(`products.errors.${k}`),
          )
        }
      }
    } finally {
      setFormBusy(false)
    }
  }

  async function executeDelete() {
    if (deleteTarget == null) {
      return
    }
    const row = deleteTarget
    setFormError(null)
    setDeletingId(row.id)
    const r = await deleteProduct(row.id)
    setDeletingId(null)
    setDeleteTarget(null)
    if (r.ok) {
      if (formMode.type === 'edit' && formMode.product.id === row.id) {
        setFormMode({ type: 'closed' })
      }
      await refresh()
      setFormError(null)
      toast.warning(t('products.toast.deleted', { name: row.name }))
    } else {
      const k = mapIpcErrorKey(r.error.message)
      setFormError(
        k === 'generic'
          ? t('products.errors.generic', { message: r.error.message })
          : t(`products.errors.${k}`),
      )
    }
  }

  return (
    <div className="prod">
      <header className="prod__header">
        <div>
          <h1 className="prod__title" id="prod-page-title">
            {t('products.pageTitle')}
          </h1>
          <p className="prod__intro">{t('products.intro')}</p>
        </div>
      </header>

      {loadError ? (
        <p className="prod-banner prod-banner--error" role="alert">
          {t('products.loadError', { message: loadError })}
        </p>
      ) : null}

      <div className="prod__toolbar" role="search">
        <div className="prod__search">
          <span className="prod__search-icon" aria-hidden>
            <Search size={20} strokeWidth={2} />
          </span>
          <input
            className="prod__search-input"
            type="search"
            autoComplete="off"
            placeholder={t('products.toolbar.searchPlaceholder')}
            aria-label={t('products.toolbar.searchAria')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="prod__toolbar-end">
          <button
            type="button"
            className="prod-btn prod-btn--primary"
            onClick={() => {
              setFormError(null)
              setFormMode({ type: 'create' })
            }}
            title={t('products.actions.add')}
          >
            <Plus size={18} strokeWidth={2} aria-hidden />
            {t('products.actions.add')}
          </button>
        </div>
      </div>

      <section className="prod-panel" aria-labelledby="prod-table-title">
        <div className="prod-panel__head">
          <h2 className="prod-panel__title" id="prod-table-title">
            {t('products.table.sectionTitle')}
            {loading ? <span className="prod-visually-hidden"> {t('products.loadingShort')}</span> : null}
          </h2>
        </div>

        {showEmpty ? (
          <div className="prod-empty" role="status">
            <p className="prod-empty__title">{t('products.empty.noResultsTitle')}</p>
            <p className="prod-empty__body">{t('products.empty.noResultsBody')}</p>
            <button type="button" className="prod-btn prod-btn--ghost" onClick={() => setQuery('')}>
              {t('products.empty.clearSearch')}
            </button>
          </div>
        ) : null}

        {showCatalogEmpty ? (
          <div className="prod-empty" role="status">
            <p className="prod-empty__title">{t('products.empty.catalogEmptyTitle')}</p>
            <p className="prod-empty__body">{t('products.empty.catalogEmptyBody')}</p>
            <button
              type="button"
              className="prod-btn prod-btn--primary"
              onClick={() => {
                setFormError(null)
                setFormMode({ type: 'create' })
              }}
            >
              {t('products.empty.addFirstProduct')}
            </button>
          </div>
        ) : null}

        {!showEmpty && !showCatalogEmpty ? (
          <div className="prod-table-wrap" aria-busy={loading || undefined}>
            <table className="prod-table">
              <colgroup>
                <col className="prod-table__col-sku" />
                <col className="prod-table__col-name" />
                <col className="prod-table__col-stock" />
                <col className="prod-table__col-price" />
                <col className="prod-table__col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">{t('products.table.sku')}</th>
                  <th scope="col">{t('products.table.name')}</th>
                  <th scope="col" className="prod-table__num">
                    {t('products.table.stock')}
                  </th>
                  <th scope="col" className="prod-table__num">
                    {t('products.table.price')}
                  </th>
                  <th scope="col">
                    <span className="prod-visually-hidden">{t('products.table.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="prod-table__cell-muted">
                      {t('products.table.loadingRow')}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <code className="prod-code">{row.sku}</code>
                      </td>
                      <td className="prod-table__cell-truncate">
                        <span className="prod-table__ellipsis" title={row.name}>
                          {row.name}
                        </span>
                      </td>
                      <td className="prod-table__num">
                        <span className={row.stock === 0 ? 'prod-stock prod-stock--out' : 'prod-stock'}>
                          {row.stock.toLocaleString(
                            lng.startsWith('ar') ? 'ar-LB' : 'en-US',
                          )}
                        </span>
                      </td>
                      <td className="prod-table__num prod-table__strong">
                        {formatLbp(row.priceLbp, lng)}
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
                              setFormMode({ type: 'edit', product: row })
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
                              setDeleteTarget(row)
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
      </section>

      {formError ? (
        <p className="prod-banner prod-banner--error prod-banner--after-section" role="alert">
          {formError}
        </p>
      ) : null}

      {formMode.type === 'create' || formMode.type === 'edit' ? (
        <ProductFormDialog
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

      {deleteTarget ? (
        <DeleteProductDialog
          product={deleteTarget}
          busy={deletingId != null}
          onCancel={() => {
            if (deletingId == null) {
              setDeleteTarget(null)
            }
          }}
          onConfirm={() => {
            void executeDelete()
          }}
        />
      ) : null}
    </div>
  )
}
