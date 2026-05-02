import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CategoryDto,
  CategoryFlavorDto,
  CategorySizeDto,
  CreateProductInput,
  ProductDto,
  UpdateProductInput,
} from '../../../../shared/ipc/types'
import { formatLbp } from '../pos/formatPos'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { SearchableSelect } from '../../components/SearchableSelect'
import './ProductFormDialog.css'

type Mode = { type: 'create' } | { type: 'edit'; product: ProductDto }

type SavePayload = { create: CreateProductInput } | { id: string; input: UpdateProductInput }
type FormState = Omit<CreateProductInput, 'basePriceLbp' | 'priceLbp' | 'stock'> & {
  basePriceLbp: number | null
  priceLbp: number | null
  stock: number | null
}

type Props = {
  mode: Mode
  categoryOptions: CategoryDto[]
  sizeOptions: CategorySizeDto[]
  flavorOptions: CategoryFlavorDto[]
  onOpenChange: (open: boolean) => void
  onSave: (payload: SavePayload) => Promise<boolean> | boolean
  busy?: boolean
  variant?: 'modal' | 'inline'
  barcodeResetKey?: number
}

const DRAFT_KEY_PREFIX = 'deken_pf_draft_'

const empty: FormState = {
  sku: '',
  name: '',
  barcode: '',
  categoryId: null,
  categorySizeId: null,
  categoryFlavorId: null,
  basePriceLbp: null,
  priceLbp: null,
  stock: null,
}

function calcProfit(basePriceLbp: number | null, priceLbp: number | null): { amountLbp: number; marginPct: number | null } {
  const base = basePriceLbp ?? 0
  const price = priceLbp ?? 0
  const amountLbp = price - base
  if (price <= 0) {
    return { amountLbp, marginPct: null }
  }
  return { amountLbp, marginPct: (amountLbp / price) * 100 }
}

export function ProductFormDialog({
  mode,
  categoryOptions,
  sizeOptions,
  flavorOptions,
  onOpenChange,
  onSave,
  busy,
  variant = 'modal',
  barcodeResetKey,
}: Props) {
  const { t, i18n } = useTranslation()
  const { settings } = useAppSettings()
  const lng = i18n.language
  const titleId = useId()
  const [form, setForm] = useState<FormState>(empty)
  const [isLoaded, setIsLoaded] = useState(false)
  const open = true
  const profit = calcProfit(form.basePriceLbp, form.priceLbp)
  const pctLabel =
    profit.marginPct == null
      ? t('common.emDash')
      : `${profit.marginPct.toLocaleString(lng.startsWith('ar') ? 'ar-LB' : 'en-US', { maximumFractionDigits: 1 })}%`
  
  const [inputCurrency, setInputCurrency] = useState<'lbp' | 'usd'>('lbp')

  const getDisplayPrice = (lbp: number | null, currency: 'lbp' | 'usd') => {
    if (lbp == null) return ''
    if (currency === 'lbp') return String(lbp)
    // Avoid large precision decimals for USD
    const usd = lbp / settings.lbpPerUsd
    return Number.isInteger(usd) ? String(usd) : usd.toFixed(2)
  }

  const handlePriceChange = (field: 'basePriceLbp' | 'priceLbp', val: string, currency: 'lbp' | 'usd') => {
    if (val === '') {
      set(field, null)
      return
    }
    const num = Number(val)
    if (isNaN(num)) return
    
    if (currency === 'lbp') {
      set(field, Math.max(0, Math.round(num)))
    } else {
      set(field, Math.max(0, Math.round(num * settings.lbpPerUsd)))
    }
  }

  useEffect(() => {
    setIsLoaded(false)
    const draftKey = mode.type === 'create' ? `${DRAFT_KEY_PREFIX}create` : `${DRAFT_KEY_PREFIX}edit_${mode.product.id}`
    const saved = localStorage.getItem(draftKey)
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') {
          setForm(parsed)
          return
        }
      } catch (e) {
        localStorage.removeItem(draftKey)
      }
    }

    if (mode.type === 'edit') {
      const p = mode.product
      setForm({
        sku: p.sku,
        name: p.name,
        barcode: p.barcode ?? '',
        categoryId: p.category?.id ?? null,
        categorySizeId: p.size?.id ?? null,
        categoryFlavorId: p.flavor?.id ?? null,
        basePriceLbp: Number.isFinite(p.basePriceLbp) ? p.basePriceLbp : null,
        priceLbp: Number.isFinite(p.priceLbp) ? p.priceLbp : null,
        stock: Number.isFinite(p.stock) ? p.stock : null,
      })
    } else {
      setForm(empty)
    }
    setIsLoaded(true)
  }, [mode])

  // Save draft on every change
  useEffect(() => {
    if (!isLoaded) return
    const draftKey = mode.type === 'create' ? `${DRAFT_KEY_PREFIX}create` : `${DRAFT_KEY_PREFIX}edit_${mode.product.id}`
    localStorage.setItem(draftKey, JSON.stringify(form))
  }, [form, mode, isLoaded])

  useEffect(() => {
    if (barcodeResetKey && mode.type === 'create') {
      setForm((f) => ({ ...f, barcode: '' }))
      focusField('pf-barcode')
    }
  }, [barcodeResetKey, mode.type])

  const isEdit = mode.type === 'edit'

  function onClose() {
    onOpenChange(false)
  }

  function set<K extends keyof FormState>(key: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [key]: v }))
  }

  /**
   * USB/Bluetooth barcode and QR imagers in "keyboard wedge" mode type characters
   * and often send Enter at the end. Without this, that Enter submits the form early.
   * We move focus to the next field so scanning feels like a line-of-business flow.
   */
  const nextFieldId: Record<string, string> = {
    'pf-name': 'pf-cat',
    'pf-cat': 'pf-barcode',
    'pf-barcode': 'pf-size',
    'pf-size': 'pf-flavor',
    'pf-flavor': 'pf-base-price',
    'pf-base-price': 'pf-price',
    'pf-price': 'pf-stock',
  }

  function focusField(id: string) {
    window.queueMicrotask(() => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null
      if (el) {
        el.focus()
        if (el instanceof HTMLInputElement) {
          if (el.type === 'text' || el.type === 'search' || el.type === 'number') {
            el.select()
          }
        }
      }
    })
  }

  function onFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'Enter' || e.repeat) {
      return
    }
    if (!(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) {
      return
    }
    const target = e.target
    if (target.id === 'pf-stock') {
      return
    }
    e.preventDefault()
    const next = nextFieldId[target.id]
    if (next) {
      focusField(next)
    }
  }

  function resetForm() {
    setForm(empty)
    const draftKey = mode.type === 'create' ? `${DRAFT_KEY_PREFIX}create` : `${DRAFT_KEY_PREFIX}edit_${mode.product.id}`
    localStorage.removeItem(draftKey)
    focusField('pf-name')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return

    console.log('[ProductForm] Submitting...', { form, settings })

    const nameTrim = form.name?.trim() || ''
    const catIdTrim = form.categoryId?.trim() || ''

    // 1. Specific field requirements
    if (settings.productFormNameRequired && !nameTrim) {
      toast.error(t('products.errors.name_required'))
      return
    }
    if (settings.productFormCategoryRequired && !catIdTrim) {
      toast.error(t('products.errors.category_not_found')) // Or add a specific "category required" translation
      return
    }

    // Global "at least one" requirement is now removed to allow Barcode-only products.
    // If the user wants specific fields to be mandatory, they can enable them in settings.

    const categoryId = form.categoryId && String(form.categoryId).trim() ? String(form.categoryId) : null
    const categorySizeId =
      form.categorySizeId && String(form.categorySizeId).trim() ? String(form.categorySizeId) : null
    const categoryFlavorId =
      form.categoryFlavorId && String(form.categoryFlavorId).trim() ? String(form.categoryFlavorId) : null
    const basePriceLbp = form.basePriceLbp ?? 0
    const priceLbp = form.priceLbp ?? 0
    const stock = form.stock ?? 0

    let payload: SavePayload
    if (isEdit) {
      payload = {
        id: mode.product.id,
        input: {
          categorySizeId,
          categoryFlavorId,
          barcode: form.barcode?.trim() ? form.barcode : null,
          name: nameTrim || null,
          basePriceLbp,
          priceLbp,
          stock,
        },
      }
    } else {
      payload = {
        create: {
          sku: '',
          categoryId: categoryId ?? undefined,
          categorySizeId: categorySizeId ?? undefined,
          categoryFlavorId: categoryFlavorId ?? undefined,
          barcode: form.barcode,
          name: nameTrim || null,
          basePriceLbp,
          priceLbp,
          stock,
        },
      }
    }

    console.log('[ProductForm] Final Payload:', payload)

    try {
      const result = await onSave(payload)
      console.log('[ProductForm] onSave result:', result)
      if (result) {
        const draftKey = mode.type === 'create' ? `${DRAFT_KEY_PREFIX}create` : `${DRAFT_KEY_PREFIX}edit_${mode.product.id}`
        localStorage.removeItem(draftKey)
      }
    } catch (err) {
      console.error('[ProductForm] onSave crashed:', err)
    }
  }

  function onBackdropClick(e: React.MouseEvent) {
    if (variant !== 'modal') {
      return
    }
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const selectCategoryValue = form.categoryId ?? ''
  const selectSizeValue = form.categorySizeId ?? ''
  const selectFlavorValue = form.categoryFlavorId ?? ''
  const filteredSizes = form.categoryId
    ? sizeOptions.filter((s) => s.categoryId === form.categoryId)
    : []
  const filteredFlavors = form.categoryId
    ? flavorOptions.filter((f) => f.categoryId === form.categoryId)
    : []

  if (variant === 'inline') {
    return (
      <section className="pf-inline" aria-labelledby={titleId}>
        <div className="pf-dialog pf-dialog--inline">
          <h2 className="pf-dialog__title" id={titleId}>
            {isEdit ? t('products.form.titleEdit') : t('products.form.titleCreate')}
          </h2>
          <form className="pf-form" onKeyDown={onFormKeyDown} onSubmit={handleSubmit}>
              {settings.productFormShowName && (
                <div className="pf-field">
                  <label htmlFor="pf-name">
                    {t('products.form.name')}
                    {settings.productFormNameRequired && <span className="pf-required"> *</span>}
                  </label>
                  <input id="pf-name" className="pf-input" name="product-name" value={form.name || ''} onChange={(e) => set('name', e.target.value)} autoComplete="off" autoCorrect="off" spellCheck={false} />
                </div>
              )}
              {settings.productFormShowCategory && (
                <div className="pf-field">
                  <label htmlFor="pf-cat">
                    {t('products.form.category')}
                    {settings.productFormCategoryRequired && <span className="pf-required"> *</span>}
                  </label>
                  <SearchableSelect
                    id="pf-cat"
                    options={categoryOptions}
                    value={selectCategoryValue}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, categoryId: v, categorySizeId: null, categoryFlavorId: null }))
                    }}
                    placeholder={t('products.form.categoryNone')}
                    searchPlaceholder={t('products.form.searchPlaceholder')}
                    noResultsText={t('products.form.noResults')}
                  />
                </div>
              )}
            <div className="pf-field">
              <label htmlFor="pf-barcode">{t('products.form.barcode')}</label>
              <input id="pf-barcode" className="pf-input" name="product-barcode" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} required autoComplete="off" autoCorrect="off" spellCheck={false} inputMode="text" />
            </div>
            {(settings.productFormShowSize || settings.productFormShowFlavor) && (
              <div className="pf-row">
                {settings.productFormShowSize && (
                  <div className="pf-field">
                    <label htmlFor="pf-size">{t('products.form.size')}</label>
                    <SearchableSelect
                      id="pf-size"
                      options={filteredSizes}
                      value={selectSizeValue}
                      onChange={(v) => set('categorySizeId', v)}
                      disabled={!form.categoryId}
                      placeholder={t('products.form.sizeNone')}
                      searchPlaceholder={t('products.form.searchPlaceholder')}
                      noResultsText={t('products.form.noResults')}
                    />
                  </div>
                )}
                {settings.productFormShowFlavor && (
                  <div className="pf-field">
                    <label htmlFor="pf-flavor">{t('products.form.flavor')}</label>
                    <SearchableSelect
                      id="pf-flavor"
                      options={filteredFlavors}
                      value={selectFlavorValue}
                      onChange={(v) => set('categoryFlavorId', v)}
                      disabled={!form.categoryId}
                      placeholder={t('products.form.flavorNone')}
                      searchPlaceholder={t('products.form.searchPlaceholder')}
                      noResultsText={t('products.form.noResults')}
                    />
                  </div>
                )}
              </div>
            )}
            <div className="pf-row">
              <div className="pf-field">
                <label htmlFor="pf-currency">{t('products.form.currency')}</label>
                <select 
                  id="pf-currency"
                  className="pf-input pf-input--select" 
                  value={inputCurrency} 
                  onChange={(e) => setInputCurrency(e.target.value as 'lbp' | 'usd')}
                >
                  <option value="lbp">{t('products.form.currencyLbp')}</option>
                  <option value="usd">{t('products.form.currencyUsd')}</option>
                </select>
              </div>
              <div className="pf-field">
                <label htmlFor="pf-base-price">{t('products.form.basePriceLbp')}</label>
                <input
                  id="pf-base-price"
                  className="pf-input"
                  type="number"
                  min={0}
                  step={inputCurrency === 'usd' ? '0.01' : '1'}
                  value={getDisplayPrice(form.basePriceLbp, inputCurrency)}
                  onChange={(e) => handlePriceChange('basePriceLbp', e.target.value, inputCurrency)}
                  required
                />
              </div>
              <div className="pf-field">
                <label htmlFor="pf-price">{t('products.form.priceLbp')}</label>
                <input
                  id="pf-price"
                  className="pf-input"
                  type="number"
                  min={0}
                  step={inputCurrency === 'usd' ? '0.01' : '1'}
                  value={getDisplayPrice(form.priceLbp, inputCurrency)}
                  onChange={(e) => handlePriceChange('priceLbp', e.target.value, inputCurrency)}
                  required
                />
              </div>
              <div className="pf-field">
                <label htmlFor="pf-stock">{t('products.form.stock')}</label>
                <input
                  id="pf-stock"
                  className="pf-input"
                  type="number"
                  min={0}
                  step={1}
                  value={form.stock ?? ''}
                  onChange={(e) =>
                    set('stock', e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))
                  }
                  required
                />
              </div>
            </div>
            <div className="pf-profit" aria-live="polite">
              <span className="pf-profit__label">{t('products.form.profit')}</span>
              <span className={profit.amountLbp < 0 ? 'pf-profit__amount pf-profit__amount--loss' : 'pf-profit__amount'}>
                {formatLbp(profit.amountLbp, lng)}
              </span>
              <span className="pf-profit__pct">{t('products.form.profitPct', { pct: pctLabel })}</span>
            </div>
            <div className="pf-actions">
              {isEdit ? (
                <button type="button" className="pf-btn pf-btn--ghost" onClick={onClose} disabled={busy}>
                  {t('products.form.cancel')}
                </button>
              ) : (
                <button type="button" className="pf-btn pf-btn--ghost" onClick={resetForm} disabled={busy}>
                  {t('products.form.reset')}
                </button>
              )}
              <button type="submit" className="pf-btn pf-btn--primary" disabled={busy}>
                {isEdit ? t('products.form.save') : t('products.form.add')}
              </button>
            </div>
          </form>
        </div>
      </section>
    )
  }

  return (
    <div className="pf-dim" role="presentation" onClick={onBackdropClick}>
      <div className="pf-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <h2 className="pf-dialog__title" id={titleId}>
          {isEdit ? t('products.form.titleEdit') : t('products.form.titleCreate')}
        </h2>
        <form className="pf-form" onKeyDown={onFormKeyDown} onSubmit={handleSubmit}>
          {settings.productFormShowName && (
            <div className="pf-field">
              <label htmlFor="pf-name-modal">
                {t('products.form.name')}
                {settings.productFormNameRequired && <span className="pf-required"> *</span>}
              </label>
              <input
                id="pf-name-modal"
                className="pf-input"
                name="product-name"
                value={form.name || ''}
                onChange={(e) => set('name', e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          )}
          {settings.productFormShowCategory && (
            <div className="pf-field">
              <label htmlFor="pf-cat-modal">
                {t('products.form.category')}
                {settings.productFormCategoryRequired && <span className="pf-required"> *</span>}
              </label>
              <SearchableSelect
                id="pf-cat-modal"
                options={categoryOptions}
                value={selectCategoryValue}
                onChange={(v) => {
                  setForm((f) => ({
                    ...f,
                    categoryId: v,
                    categorySizeId: null,
                    categoryFlavorId: null,
                  }))
                }}
                placeholder={t('products.form.categoryNone')}
                searchPlaceholder={t('products.form.searchPlaceholder')}
                noResultsText={t('products.form.noResults')}
              />
            </div>
          )}
          <div className="pf-field">
            <label htmlFor="pf-barcode-modal">{t('products.form.barcode')}</label>
            <input
              id="pf-barcode-modal"
              className="pf-input"
              name="product-barcode"
              value={form.barcode}
              onChange={(e) => set('barcode', e.target.value)}
              required
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
            />
          </div>
          {(settings.productFormShowSize || settings.productFormShowFlavor) && (
            <div className="pf-row">
              {settings.productFormShowSize && (
                <div className="pf-field">
                  <label htmlFor="pf-size-modal">{t('products.form.size')}</label>
                  <SearchableSelect
                    id="pf-size-modal"
                    options={filteredSizes}
                    value={selectSizeValue}
                    onChange={(v) => set('categorySizeId', v)}
                    disabled={!form.categoryId}
                    placeholder={t('products.form.sizeNone')}
                    searchPlaceholder={t('products.form.searchPlaceholder')}
                    noResultsText={t('products.form.noResults')}
                  />
                </div>
              )}
              {settings.productFormShowFlavor && (
                <div className="pf-field">
                  <label htmlFor="pf-flavor-modal">{t('products.form.flavor')}</label>
                  <SearchableSelect
                    id="pf-flavor-modal"
                    options={filteredFlavors}
                    value={selectFlavorValue}
                    onChange={(v) => set('categoryFlavorId', v)}
                    disabled={!form.categoryId}
                    placeholder={t('products.form.flavorNone')}
                    searchPlaceholder={t('products.form.searchPlaceholder')}
                    noResultsText={t('products.form.noResults')}
                  />
                </div>
              )}
            </div>
          )}
          <div className="pf-field">
            <label htmlFor="pf-currency-modal">{t('products.form.currency')}</label>
            <select 
              id="pf-currency-modal"
              className="pf-input pf-input--select" 
              value={inputCurrency} 
              onChange={(e) => setInputCurrency(e.target.value as 'lbp' | 'usd')}
            >
              <option value="lbp">{t('products.form.currencyLbp')}</option>
              <option value="usd">{t('products.form.currencyUsd')}</option>
            </select>
          </div>
          <div className="pf-row">
            <div className="pf-field">
              <label htmlFor="pf-base-price-modal">{t('products.form.basePriceLbp')}</label>
              <input
                id="pf-base-price-modal"
                className="pf-input"
                type="number"
                min={0}
                step={inputCurrency === 'usd' ? '0.01' : '1'}
                value={getDisplayPrice(form.basePriceLbp, inputCurrency)}
                onChange={(e) => handlePriceChange('basePriceLbp', e.target.value, inputCurrency)}
                required
              />
            </div>
            <div className="pf-field">
              <label htmlFor="pf-price-modal">{t('products.form.priceLbp')}</label>
              <input
                id="pf-price-modal"
                className="pf-input"
                type="number"
                min={0}
                step={inputCurrency === 'usd' ? '0.01' : '1'}
                value={getDisplayPrice(form.priceLbp, inputCurrency)}
                onChange={(e) => handlePriceChange('priceLbp', e.target.value, inputCurrency)}
                required
              />
            </div>
            <div className="pf-field">
              <label htmlFor="pf-stock-modal">{t('products.form.stock')}</label>
              <input
                id="pf-stock-modal"
                className="pf-input"
                type="number"
                min={0}
                step={1}
                value={form.stock ?? ''}
                onChange={(e) =>
                  set('stock', e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))
                }
                required
              />
            </div>
          </div>
          <div className="pf-profit" aria-live="polite">
            <span className="pf-profit__label">{t('products.form.profit')}</span>
            <span className={profit.amountLbp < 0 ? 'pf-profit__amount pf-profit__amount--loss' : 'pf-profit__amount'}>
              {formatLbp(profit.amountLbp, lng)}
            </span>
            <span className="pf-profit__pct">{t('products.form.profitPct', { pct: pctLabel })}</span>
          </div>
          <div className="pf-actions">
            {isEdit ? (
              <button type="button" className="pf-btn pf-btn--ghost" onClick={onClose} disabled={busy}>
                {t('products.form.cancel')}
              </button>
            ) : (
              <button type="button" className="pf-btn pf-btn--ghost" onClick={resetForm} disabled={busy}>
                {t('products.form.reset')}
              </button>
            )}
            <button type="submit" className="pf-btn pf-btn--primary" disabled={busy}>
              {isEdit ? t('products.form.save') : t('products.form.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
