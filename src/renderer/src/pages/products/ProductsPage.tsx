import { Download, Pencil, Search, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import type {
  CategoryDto,
  CategoryFlavorDto,
  CategorySizeDto,
  CreateProductInput,
  ProductDto,
  UpdateProductInput,
} from '../../../../shared/ipc/types'
import { useToast } from '../../components/toast'
import {
  bulkImportProducts,
  createCategoryFlavor,
  createCategorySize,
  createProduct,
  deleteCategoryFlavor,
  deleteCategorySize,
  deleteProduct,
  listCategories,
  listCategoryFlavors,
  listCategorySizes,
  listProducts,
  updateCategoryFlavor,
  updateCategorySize,
  updateProduct,
} from '../../lib/api/dekenClient'
import { parseCsv } from '../../lib/csvImport'
import { downloadAsCsvFile, fileDateStamp, toCsvLine } from '../../lib/csvExport'
import { formatLbp } from '../pos/formatPos'
import { CategoryLinkedOptionsPanel } from './CategoryLinkedOptionsPanel'
import { DeleteProductDialog } from './DeleteProductDialog'
import { ProductCategoriesPanel } from './ProductCategoriesPanel'
import { ProductFormDialog } from './ProductFormDialog'
import './ProductsPage.css'

type FormMode = { type: 'create' } | { type: 'edit'; product: ProductDto }
type PageSection = 'catalog' | 'categories' | 'sizes' | 'flavors'

function mapIpcErrorKey(message: string): string {
  const m = message.trim()
  if (
    m === 'sku_required' ||
    m === 'name_required' ||
    m === 'category_required' ||
    m === 'name_or_category_required' ||
    m === 'barcode_required' ||
    m === 'id_required' ||
    m === 'category_not_found'
  ) {
    return m
  }
  if (m === 'base_price_invalid' || m === 'price_invalid' || m === 'stock_invalid') {
    return m
  }
  if (m.toLowerCase().includes('unique') || m.includes('UNIQUE')) {
    return 'sku_taken'
  }
  return 'generic'
}

function calcProfit(basePriceLbp: number, priceLbp: number): { amountLbp: number; marginPct: number | null } {
  const amountLbp = priceLbp - basePriceLbp
  if (priceLbp <= 0) {
    return { amountLbp, marginPct: null }
  }
  return { amountLbp, marginPct: (amountLbp / priceLbp) * 100 }
}

export function ProductsPage() {
  const { t, i18n } = useTranslation()
  const { settings } = useAppSettings()
  const toast = useToast()
  const lng = i18n.language
  const [section, setSection] = useState<PageSection>('catalog')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [rows, setRows] = useState<ProductDto[]>([])
  const [loading, setLoading] = useState(true)
  const [formBusy, setFormBusy] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>({ type: 'create' })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductDto | null>(null)
  const [categoryOptions, setCategoryOptions] = useState<CategoryDto[]>([])
  const [sizeOptions, setSizeOptions] = useState<CategorySizeDto[]>([])
  const [flavorOptions, setFlavorOptions] = useState<CategoryFlavorDto[]>([])
  const [barcodeResetKey, setBarcodeResetKey] = useState(0)

  const loadCategoryOptions = useCallback(async () => {
    const r = await listCategories()
    if (r.ok) {
      setCategoryOptions(r.data)
    }
  }, [])
  const loadSizeOptions = useCallback(async () => {
    const r = await listCategorySizes()
    if (r.ok) setSizeOptions(r.data)
  }, [])
  const loadFlavorOptions = useCallback(async () => {
    const r = await listCategoryFlavors()
    if (r.ok) setFlavorOptions(r.data)
  }, [])

  useEffect(() => {
    void loadCategoryOptions()
    void loadSizeOptions()
    void loadFlavorOptions()
  }, [loadCategoryOptions, loadFlavorOptions, loadSizeOptions])

  useEffect(() => {
    void loadCategoryOptions()
    void loadSizeOptions()
    void loadFlavorOptions()
  }, [formMode, loadCategoryOptions, loadFlavorOptions, loadSizeOptions])

  useEffect(() => {
    const tmr = window.setTimeout(() => setSearchDebounced(query), 200)
    return () => window.clearTimeout(tmr)
  }, [query])

  const filterCategoryIdParam = useMemo(
    () => (filterCategory === '' ? null : filterCategory),
    [filterCategory],
  )

  const refresh = useCallback(async () => {
    if (section !== 'catalog') {
      return
    }
    setLoadError(null)
    setLoading(true)
    const res = await listProducts(searchDebounced, filterCategoryIdParam)
    setLoading(false)
    if (res.ok) {
      setRows(res.data)
    } else {
      setLoadError(res.error.message)
    }
  }, [searchDebounced, filterCategoryIdParam, section])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const hasRefinement = useMemo(
    () => query.trim() !== '' || filterCategory !== '',
    [query, filterCategory],
  )
  const filtered = useMemo(() => rows, [rows])

  const showEmpty = section === 'catalog' && hasRefinement && !loading && filtered.length === 0
  const showCatalogEmpty =
    section === 'catalog' && !hasRefinement && !loading && filtered.length === 0

  const onCategoriesChanged = useCallback(() => {
    void loadCategoryOptions()
    void loadSizeOptions()
    void loadFlavorOptions()
  }, [loadCategoryOptions, loadFlavorOptions, loadSizeOptions])

  async function onFormSave(
    payload: { create: CreateProductInput } | { id: string; input: UpdateProductInput },
  ): Promise<boolean> {
    setFormError(null)
    setFormBusy(true)
    console.log('[ProductsPage] onFormSave payload:', payload)
    try {
      if ('create' in payload) {
        console.log('[ProductsPage] Creating product...', payload.create)
        const r = await createProduct(payload.create)
        console.log('[ProductsPage] createProduct result:', r)
        if (r.ok) {
          if (formMode.type === 'edit') {
            setFormMode({ type: 'create' })
          }
          await refresh()
          setFormError(null)
          setBarcodeResetKey(prev => prev + 1)
          toast.success(t('products.toast.added'))
          return true
        } else {
          const k = mapIpcErrorKey(r.error.message)
          const msg = k === 'generic'
            ? t('products.errors.generic', { message: r.error.message })
            : t(`products.errors.${k}`)
          setFormError(msg)
          toast.error(msg)
          return false
        }
      } else {
        console.log('[ProductsPage] Updating product...', payload.id, payload.input)
        const r = await updateProduct(payload.id, payload.input)
        console.log('[ProductsPage] updateProduct result:', r)
        if (r.ok) {
          setFormMode({ type: 'create' })
          await refresh()
          setFormError(null)
          toast.success(t('products.toast.updated'))
          return true
        } else {
          const k = mapIpcErrorKey(r.error.message)
          const msg = k === 'generic'
            ? t('products.errors.generic', { message: r.error.message })
            : t(`products.errors.${k}`)
          setFormError(msg)
          toast.error(msg)
          return false
        }
      }
    } finally {
      setFormBusy(false)
    }
  }

  function runExportCatalog() {
    if (filtered.length === 0) {
      toast.warning(t('common.exportEmpty'))
      return
    }
    const h = toCsvLine([
      'id',
      t('products.table.name'),
      t('products.table.category'),
      t('products.table.size'),
      t('products.table.flavor'),
      t('products.table.rowBarcode'),
      'base_price_lbp',
      'price_lbp',
      t('products.table.stock'),
    ])
    const body = filtered.map((p) =>
      toCsvLine([
        p.id,
        p.name,
        p.category?.name ?? '',
        p.size?.name ?? '',
        p.flavor?.name ?? '',
        p.barcode ?? '',
        p.basePriceLbp,
        p.priceLbp,
        p.stock,
      ]),
    )
    downloadAsCsvFile(`deken-products-${fileDateStamp()}`, [h, ...body])
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
        const inputs = bodyRows
          .map((row) => ({
            name: row[0],
            sku: row[1] || undefined,
            barcode: row[2] || undefined,
            categoryName: row[3] || undefined,
            sizeName: row[4] || undefined,
            flavorName: row[5] || undefined,
            basePriceLbp: row[6] ? Math.floor(Number(row[6])) : undefined,
            priceLbp: row[7] ? Math.floor(Number(row[7])) : undefined,
            stock: row[8] ? Math.floor(Number(row[8])) : undefined,
          }))
          .filter((i) => i.name && i.name.trim().length > 0)

        if (inputs.length === 0) {
          toast.warning(t('common.exportEmpty'))
          return
        }

        setLoading(true)
        const res = await bulkImportProducts(inputs)
        setLoading(false)

        if (res.ok) {
          toast.success(t('common.importToast', { count: res.data.imported }))
          void refresh()
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
        setFormMode({ type: 'create' })
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
        </div>
      </header>

      <div className="prod__tabs" role="tablist" aria-label={t('products.tabs.aria')}>
        <button
          type="button"
          className={`prod__tab${section === 'catalog' ? ' prod__tab--active' : ''}`}
          role="tab"
          aria-selected={section === 'catalog'}
          onClick={() => setSection('catalog')}
        >
          {t('products.tabs.catalog')}
        </button>
        <button
          type="button"
          className={`prod__tab${section === 'categories' ? ' prod__tab--active' : ''}`}
          role="tab"
          aria-selected={section === 'categories'}
          onClick={() => setSection('categories')}
        >
          {t('products.tabs.categories')}
        </button>
        <button
          type="button"
          className={`prod__tab${section === 'sizes' ? ' prod__tab--active' : ''}`}
          role="tab"
          aria-selected={section === 'sizes'}
          onClick={() => setSection('sizes')}
        >
          {t('products.tabs.sizes')}
        </button>
        <button
          type="button"
          className={`prod__tab${section === 'flavors' ? ' prod__tab--active' : ''}`}
          role="tab"
          aria-selected={section === 'flavors'}
          onClick={() => setSection('flavors')}
        >
          {t('products.tabs.flavors')}
        </button>
      </div>

      {loadError && section === 'catalog' ? (
        <p className="prod-banner prod-banner--error" role="alert">
          {t('products.loadError', { message: loadError })}
        </p>
      ) : null}

      {section === 'categories' ? (
        <ProductCategoriesPanel onCategoriesChanged={onCategoriesChanged} />
      ) : null}
      {section === 'sizes' ? (
        <CategoryLinkedOptionsPanel
          kind="sizes"
          categories={categoryOptions}
          onChanged={onCategoriesChanged}
          listRows={listCategorySizes}
          createRow={createCategorySize}
          updateRow={updateCategorySize}
          deleteRow={deleteCategorySize}
        />
      ) : null}
      {section === 'flavors' ? (
        <CategoryLinkedOptionsPanel
          kind="flavors"
          categories={categoryOptions}
          onChanged={onCategoriesChanged}
          listRows={listCategoryFlavors}
          createRow={createCategoryFlavor}
          updateRow={updateCategoryFlavor}
          deleteRow={deleteCategoryFlavor}
        />
      ) : null}

      {section === 'catalog' ? (
        <>
          <ProductFormDialog
            mode={formMode}
            variant="inline"
            categoryOptions={categoryOptions}
            sizeOptions={sizeOptions}
            flavorOptions={flavorOptions}
            onOpenChange={(o) => {
              if (!o) {
                setFormError(null)
                setFormMode({ type: 'create' })
              }
            }}
            onSave={onFormSave}
            busy={formBusy}
            barcodeResetKey={barcodeResetKey}
          />

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
              />
            </div>
            <div className="prod__toolbar-end">
              <button
                type="button"
                className="prod-btn prod-btn--ghost"
                onClick={runExportCatalog}
                disabled={loading || rows.length === 0}
                title={t('common.exportAria')}
                aria-label={t('common.exportAria')}
              >
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
              <label className="prod__filter">
                <span className="prod__filter-label">{t('products.toolbar.filterLabel')}</span>
                <select
                  className="prod__filter-select"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  disabled={loading}
                  aria-label={t('products.toolbar.filterLabel')}
                >
                  <option value="">{t('products.toolbar.allCategories')}</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <section className="prod-panel" aria-labelledby="prod-table-title">
            <div className="prod-panel__head">
              <h2 className="prod-panel__title" id="prod-table-title">
                {t('products.table.sectionTitle')}
                {loading ? (
                  <span className="prod-visually-hidden"> {t('products.loadingShort')}</span>
                ) : null}
              </h2>
            </div>

            {showEmpty ? (
              <div className="prod-empty" role="status">
                <p className="prod-empty__title">{t('products.empty.noResultsTitle')}</p>
                <p className="prod-empty__body">{t('products.empty.noResultsBody')}</p>
                <div className="prod-empty__actions">
                  {query.trim() !== '' ? (
                    <button type="button" className="prod-btn prod-btn--ghost" onClick={() => setQuery('')}>
                      {t('products.empty.clearSearch')}
                    </button>
                  ) : null}
                  {filterCategory !== '' ? (
                    <button
                      type="button"
                      className="prod-btn prod-btn--ghost"
                      onClick={() => setFilterCategory('')}
                    >
                      {t('products.empty.clearCategoryFilter')}
                    </button>
                  ) : null}
                </div>
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
                    {settings.productFormShowName && <col className="prod-table__col-name" />}
                    {settings.productFormShowCategory && <col className="prod-table__col-cat" />}
                    {settings.productFormShowSize && <col className="prod-table__col-cat" />}
                    {settings.productFormShowFlavor && <col className="prod-table__col-cat" />}
                    <col className="prod-table__col-stock" />
                    <col className="prod-table__col-price" />
                    <col className="prod-table__col-price" />
                    <col className="prod-table__col-profit" />
                    <col className="prod-table__col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">{t('products.table.idColumn')}</th>
                      {settings.productFormShowName && <th scope="col">{t('products.table.name')}</th>}
                      {settings.productFormShowCategory && <th scope="col">{t('products.table.category')}</th>}
                      {settings.productFormShowSize && <th scope="col">{t('products.table.size')}</th>}
                      {settings.productFormShowFlavor && <th scope="col">{t('products.table.flavor')}</th>}
                      <th scope="col" className="prod-table__num">
                        {t('products.table.stock')}
                      </th>
                      <th scope="col" className="prod-table__num">
                        {t('products.table.basePrice')}
                      </th>
                      <th scope="col" className="prod-table__num">
                        {t('products.table.price')}
                      </th>
                      <th scope="col" className="prod-table__num">
                        {t('products.table.profit')}
                      </th>
                      <th scope="col">
                        <span className="prod-visually-hidden">{t('products.table.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6 + (settings.productFormShowName ? 1 : 0) + (settings.productFormShowCategory ? 1 : 0) + (settings.productFormShowSize ? 1 : 0) + (settings.productFormShowFlavor ? 1 : 0)} className="prod-table__cell-muted">
                          {t('products.table.loadingRow')}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row, idx) => {
                        const profit = calcProfit(row.basePriceLbp, row.priceLbp)
                        const pctLabel =
                          profit.marginPct == null
                            ? t('common.emDash')
                            : `${profit.marginPct.toLocaleString(lng.startsWith('ar') ? 'ar-LB' : 'en-US', {
                                maximumFractionDigits: 1,
                              })}%`
                        return (
                        <tr key={row.id}>
                          <td>
                            <code className="prod-code">{idx + 1}</code>
                          </td>
                          {settings.productFormShowName && (
                            <td className="prod-table__cell-truncate">
                              <span className="prod-table__ellipsis" title={row.name}>
                                {row.name}
                              </span>
                            </td>
                          )}
                          {settings.productFormShowCategory && (
                            <td className="prod-table__cell-muted prod-table__cell-truncate">
                              <span
                                className="prod-table__ellipsis"
                                title={row.category?.name}
                              >
                                {row.category?.name
                                  ? row.category.name
                                  : t('common.emDash')}
                              </span>
                            </td>
                          )}
                          {settings.productFormShowSize && (
                            <td className="prod-table__cell-muted prod-table__cell-truncate">
                              <span className="prod-table__ellipsis" title={row.size?.name}>
                                {row.size?.name ? row.size.name : t('common.emDash')}
                              </span>
                            </td>
                          )}
                          {settings.productFormShowFlavor && (
                            <td className="prod-table__cell-muted prod-table__cell-truncate">
                              <span className="prod-table__ellipsis" title={row.flavor?.name}>
                                {row.flavor?.name ? row.flavor.name : t('common.emDash')}
                              </span>
                            </td>
                          )}
                          <td className="prod-table__num">
                            <span
                              className={
                                row.stock === 0 ? 'prod-stock prod-stock--out' : 'prod-stock'
                              }
                            >
                              {row.stock.toLocaleString(
                                lng.startsWith('ar') ? 'ar-LB' : 'en-US',
                              )}
                            </span>
                          </td>
                          <td className="prod-table__num prod-table__strong">
                            {formatLbp(row.basePriceLbp, lng)}
                          </td>
                          <td className="prod-table__num prod-table__strong">
                            {formatLbp(row.priceLbp, lng)}
                          </td>
                          <td className="prod-table__num prod-table__strong">
                            <div className="prod-profit">
                              <span
                                className={
                                  profit.amountLbp < 0
                                    ? 'prod-profit__amount prod-profit__amount--loss'
                                    : 'prod-profit__amount'
                                }
                              >
                                {formatLbp(profit.amountLbp, lng)}
                              </span>
                              <span className="prod-profit__pct">{pctLabel}</span>
                            </div>
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
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {formError && section === 'catalog' ? (
        <p className="prod-banner prod-banner--error prod-banner--after-section" role="alert">
          {formError}
        </p>
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
