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
  onSave: (payload: SavePayload) => void
  busy?: boolean
  variant?: 'modal' | 'inline'
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

export function ProductFormDialog({
  mode,
  categoryOptions,
  sizeOptions,
  flavorOptions,
  onOpenChange,
  onSave,
  busy,
  variant = 'modal',
}: Props) {
  const { t } = useTranslation()
  const titleId = useId()
  const [form, setForm] = useState<FormState>(empty)
  const open = true

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const categoryId = form.categoryId && String(form.categoryId).trim() ? String(form.categoryId) : null
    const categorySizeId =
      form.categorySizeId && String(form.categorySizeId).trim() ? String(form.categorySizeId) : null
    const categoryFlavorId =
      form.categoryFlavorId && String(form.categoryFlavorId).trim() ? String(form.categoryFlavorId) : null
    const basePriceLbp = form.basePriceLbp ?? 0
    const priceLbp = form.priceLbp ?? 0
    const stock = form.stock ?? 0
    if (isEdit) {
      onSave({
        id: mode.product.id,
        input: {
          name: form.name,
          categoryId,
          categorySizeId,
          categoryFlavorId,
          barcode: form.barcode?.trim() ? form.barcode : null,
          basePriceLbp,
          priceLbp,
          stock,
        },
      })
    } else {
      onSave({
        create: {
          sku: '',
          name: form.name,
          categoryId: categoryId ?? undefined,
          categorySizeId: categorySizeId ?? undefined,
          categoryFlavorId: categoryFlavorId ?? undefined,
          barcode: form.barcode,
          basePriceLbp,
          priceLbp,
          stock,
        },
      })
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
            <div className="pf-field">
              <label htmlFor="pf-name">{t('products.form.name')}</label>
              <input id="pf-name" className="pf-input" name="product-name" value={form.name} onChange={(e) => set('name', e.target.value)} required autoComplete="off" autoCorrect="off" spellCheck={false} />
            </div>
            <div className="pf-field">
              <label htmlFor="pf-cat">{t('products.form.category')}</label>
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
            <div className="pf-field">
              <label htmlFor="pf-barcode">{t('products.form.barcode')}</label>
              <input id="pf-barcode" className="pf-input" name="product-barcode" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} autoComplete="off" autoCorrect="off" spellCheck={false} inputMode="text" />
            </div>
            <div className="pf-row">
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
            </div>
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
            <div className="pf-actions">
              {isEdit ? (
                <button type="button" className="pf-btn pf-btn--ghost" onClick={onClose} disabled={busy}>
                  {t('products.form.cancel')}
                </button>
              ) : null}
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
          <div className="pf-field">
            <label htmlFor="pf-name">{t('products.form.name')}</label>
            <input
              id="pf-name"
              className="pf-input"
              name="product-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="pf-field">
            <label htmlFor="pf-cat">{t('products.form.category')}</label>
            <select
              id="pf-cat"
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
          <div className="pf-field">
            <label htmlFor="pf-barcode">{t('products.form.barcode')}</label>
            <input
              id="pf-barcode"
              className="pf-input"
              name="product-barcode"
              value={form.barcode}
              onChange={(e) => set('barcode', e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
            />
          </div>
          <div className="pf-row">
            <div className="pf-field">
              <label htmlFor="pf-size">{t('products.form.size')}</label>
              <select
                id="pf-size"
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
            <div className="pf-field">
              <label htmlFor="pf-flavor">{t('products.form.flavor')}</label>
              <select
                id="pf-flavor"
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
          </div>
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
          <div className="pf-actions">
            <button type="button" className="pf-btn pf-btn--ghost" onClick={onClose} disabled={busy}>
              {t('products.form.cancel')}
            </button>
            <button type="submit" className="pf-btn pf-btn--primary" disabled={busy}>
              {isEdit ? t('products.form.save') : t('products.form.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
