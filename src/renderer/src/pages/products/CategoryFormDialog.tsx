import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CategoryDto } from '../../../../shared/ipc/types'
import './ProductFormDialog.css'

type Mode = { type: 'create' } | { type: 'edit'; category: CategoryDto }

type SavePayload = { create: { name: string } } | { id: string; name: string }

type Props = {
  open: boolean
  mode: Mode
  onOpenChange: (open: boolean) => void
  onSave: (payload: SavePayload) => void
  busy?: boolean
}

export function CategoryFormDialog({ open, mode, onOpenChange, onSave, busy }: Props) {
  const { t } = useTranslation()
  const titleId = useId()
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }
    if (mode.type === 'edit') {
      setName(mode.category.name)
    } else {
      setName('')
    }
  }, [open, mode])

  if (!open) {
    return null
  }

  const isEdit = mode.type === 'edit'

  function onClose() {
    onOpenChange(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) {
      return
    }
    if (isEdit) {
      onSave({ id: mode.category.id, name: n })
    } else {
      onSave({ create: { name: n } })
    }
  }

  function onBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

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
          {isEdit ? t('productCategories.form.titleEdit') : t('productCategories.form.titleCreate')}
        </h2>
        <form className="pf-form" onSubmit={handleSubmit}>
          <div className="pf-field">
            <label htmlFor="pcat-name">{t('productCategories.form.name')}</label>
            <input
              id="pcat-name"
              className="pf-input"
              name="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              autoComplete="off"
            />
          </div>
          <div className="pf-actions">
            <button type="button" className="pf-btn pf-btn--ghost" onClick={onClose} disabled={busy}>
              {t('products.form.cancel')}
            </button>
            <button type="submit" className="pf-btn pf-btn--primary" disabled={busy}>
              {isEdit ? t('products.form.save') : t('productCategories.form.add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
