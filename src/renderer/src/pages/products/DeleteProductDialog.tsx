import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProductDto } from '../../../../shared/ipc/types'
import './DeleteProductDialog.css'

type Props = {
  product: ProductDto
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
}

/**
 * In-app delete confirmation. Avoids `window.confirm`, which breaks keyboard focus in Electron.
 */
export function DeleteProductDialog({ product, onCancel, onConfirm, busy }: Props) {
  const { t } = useTranslation()
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [product.id])

  function onBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !busy) {
      onCancel()
    }
  }

  return (
    <div
      className="pdel-dim"
      role="presentation"
      onClick={onBackdropClick}
    >
      <div
        className="pdel-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="pdel-dialog__title" id={titleId}>
          {t('products.delete.title')}
        </h2>
        <p className="pdel-dialog__body">
          {t('products.delete.confirm', { name: product.name, sku: product.sku })}
        </p>
        <div className="pdel-dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="pdel-btn pdel-btn--ghost"
            disabled={busy}
            onClick={onCancel}
          >
            {t('products.form.cancel')}
          </button>
          <button
            type="button"
            className="pdel-btn pdel-btn--danger"
            disabled={busy}
            onClick={onConfirm}
          >
            {t('products.actions.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
