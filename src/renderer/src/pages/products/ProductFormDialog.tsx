import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CategoryDto, CreateProductInput, ProductDto, UpdateProductInput } from '../../../../shared/ipc/types'
import './ProductFormDialog.css'

type Mode = { type: 'create' } | { type: 'edit'; product: ProductDto }

type SavePayload = { create: CreateProductInput } | { id: string; input: UpdateProductInput }

type Props = {
  open: boolean
  mode: Mode
  categoryOptions: CategoryDto[]
  onOpenChange: (open: boolean) => void
  onSave: (payload: SavePayload) => void
  busy?: boolean
}

const empty: CreateProductInput = {
  sku: '',
  name: '',
  barcode: '',
  categoryId: null,
  priceLbp: 0,
  stock: 0,
}

export function ProductFormDialog({ open, mode, categoryOptions, onOpenChange, onSave, busy }: Props) {
  const { t } = useTranslation()
  const titleId = useId()
  const [form, setForm] = useState<CreateProductInput>(empty)

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
        priceLbp: p.priceLbp,
        stock: p.stock,
      })
    } else {
      setForm(empty)
    }
  }, [open, mode])

  if (!open) {
    return null
  }

  const isEdit = mode.type === 'edit'

  function onClose() {
    onOpenChange(false)
  }

  function set<K extends keyof CreateProductInput>(key: K, v: CreateProductInput[K]) {
    setForm((f) => ({ ...f, [key]: v }))
  }

  /**
   * USB/Bluetooth barcode and QR imagers in "keyboard wedge" mode type characters
   * and often send Enter at the end. Without this, that Enter submits the form early.
   * We move focus to the next field so scanning feels like a line-of-business flow.
   */
  const nextFieldId: Record<string, string> = {
    'pf-sku': 'pf-name',
    'pf-name': 'pf-cat',
    'pf-cat': 'pf-barcode',
    'pf-barcode': 'pf-price',
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
    if (isEdit) {
      onSave({
        id: mode.product.id,
        input: {
          sku: form.sku,
          name: form.name,
          categoryId,
          barcode: form.barcode?.trim() ? form.barcode : null,
          priceLbp: form.priceLbp,
          stock: form.stock,
        },
      })
    } else {
      onSave({
        create: {
          sku: form.sku,
          name: form.name,
          categoryId: categoryId ?? undefined,
          barcode: form.barcode,
          priceLbp: form.priceLbp,
          stock: form.stock,
        },
      })
    }
  }

  function onBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const selectCategoryValue = form.categoryId ?? ''

  return (
    <div
      className="pf-dim"
      role="presentation"
      onClick={onBackdropClick}
    >
      <div
        className="pf-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="pf-dialog__title" id={titleId}>
          {isEdit ? t('products.form.titleEdit') : t('products.form.titleCreate')}
        </h2>
        <p className="pf-hint" id="pf-scanner-hint">
          {t('products.form.scannerHint')}
        </p>
        <form className="pf-form" onKeyDown={onFormKeyDown} onSubmit={handleSubmit}>
          <div className="pf-field">
            <label htmlFor="pf-sku">{t('products.form.sku')}</label>
            <input
              id="pf-sku"
              className="pf-input"
              name="product-sku"
              value={form.sku}
              onChange={(e) => set('sku', e.target.value)}
              required
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
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
                set('categoryId', v === '' ? null : v)
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
              <label htmlFor="pf-price">{t('products.form.priceLbp')}</label>
              <input
                id="pf-price"
                className="pf-input"
                type="number"
                min={0}
                step={1}
                value={form.priceLbp}
                onChange={(e) => set('priceLbp', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
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
                value={form.stock}
                onChange={(e) => set('stock', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
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
