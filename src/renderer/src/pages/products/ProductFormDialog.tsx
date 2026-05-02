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
  const open = true
  const profit = calcProfit(form.basePriceLbp, form.priceLbp)
  const pctLabel =
    profit.marginPct == null
      ? t('common.emDash')
      : `${profit.marginPct.toLocaleString(lng.startsWith('ar') ? 'ar-LB' : 'en-US', { maximumFractionDigits: 1 })}%`

  useEffect(() => {
    if (!open) {
      return
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
  }, [open, mode])

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
                  <select
                    id="pf-cat"
                    className="pf-input pf-input--select"
                    value={selectCategoryValue}
                    onChange={(e) => {
                      const v = e.target.value
                      const next = v === '' ? null : v
                      setForm((f) => ({ ...f, categoryId: next, categorySizeId: null, categoryFlavorId: null }))
                    }}
                    aria-label={t('products.form.category')}
                  >
                    <option value="">{t('products.form.categoryNone')}</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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
                    <select id="pf-size" className="pf-input pf-input--select" value={selectSizeValue} onChange={(e) => set('categorySizeId', e.target.value === '' ? null : e.target.value)} disabled={!form.categoryId}>
                      <option value="">{t('products.form.sizeNone')}</option>
                      {filteredSizes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {settings.productFormShowFlavor && (
                  <div className="pf-field">
                    <label htmlFor="pf-flavor">{t('products.form.flavor')}</label>
                    <select id="pf-flavor" className="pf-input pf-input--select" value={selectFlavorValue} onChange={(e) => set('categoryFlavorId', e.target.value === '' ? null : e.target.value)} disabled={!form.categoryId}>
                      <option value="">{t('products.form.flavorNone')}</option>
                      {filteredFlavors.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className="pf-row">
              <div className="pf-field">
                <label htmlFor="pf-base-price">{t('products.form.basePriceLbp')}</label>
                <input
                  id="pf-base-price"
                  className="pf-input"
                  type="number"
                  min={0}
                  step={1}
                  value={form.basePriceLbp ?? ''}
                  onChange={(e) =>
                    set('basePriceLbp', e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))
                  }
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
                  step={1}
                  value={form.priceLbp ?? ''}
                  onChange={(e) =>
                    set('priceLbp', e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))
                  }
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
              <select
                id="pf-cat-modal"
                className="pf-input pf-input--select"
                value={selectCategoryValue}
                onChange={(e) => {
                  const v = e.target.value
                  const next = v === '' ? null : v
                  setForm((f) => ({
                    ...f,
                    categoryId: next,
                    categorySizeId: null,
                    categoryFlavorId: null,
                  }))
                }}
                aria-label={t('products.form.category')}
              >
                <option value="">{t('products.form.categoryNone')}</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
                  <select
                    id="pf-size-modal"
                    className="pf-input pf-input--select"
                    value={selectSizeValue}
                    onChange={(e) => {
                      const v = e.target.value
                      set('categorySizeId', v === '' ? null : v)
                    }}
                    disabled={!form.categoryId}
                  >
                    <option value="">{t('products.form.sizeNone')}</option>
                    {filteredSizes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {settings.productFormShowFlavor && (
                <div className="pf-field">
                  <label htmlFor="pf-flavor-modal">{t('products.form.flavor')}</label>
                  <select
                    id="pf-flavor-modal"
                    className="pf-input pf-input--select"
                    value={selectFlavorValue}
                    onChange={(e) => {
                      const v = e.target.value
                      set('categoryFlavorId', v === '' ? null : v)
                    }}
                    disabled={!form.categoryId}
                  >
                    <option value="">{t('products.form.flavorNone')}</option>
                    {filteredFlavors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="pf-row">
            <div className="pf-field">
              <label htmlFor="pf-base-price-modal">{t('products.form.basePriceLbp')}</label>
              <input
                id="pf-base-price-modal"
                className="pf-input"
                type="number"
                min={0}
                step={1}
                value={form.basePriceLbp ?? ''}
                onChange={(e) =>
                  set('basePriceLbp', e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))
                }
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
                step={1}
                value={form.priceLbp ?? ''}
                onChange={(e) =>
                  set('priceLbp', e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)))
                }
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
