import { Download } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/toast'
import { getDebtSaleLines } from '../../lib/api/dekenClient'
import { downloadAsCsvFile, toCsvLine } from '../../lib/csvExport'
import { formatLbp } from '../pos/formatPos'
import type { SaleLineViewDto } from '../../../../shared/ipc/types'
import './DebtSaleItemsDialog.css'

type Props = {
  customerId: string
  saleId: string
  atIso: string
  amountLbp: number
  onClose: () => void
}

export function DebtSaleItemsDialog({ customerId, saleId, atIso, amountLbp, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const titleId = useId()
  const lng = i18n.language
  const loc = lng.startsWith('ar') ? 'ar-LB' : 'en-US'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [items, setItems] = useState<SaleLineViewDto[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const r = await getDebtSaleLines(customerId, saleId)
    setLoading(false)
    if (r.ok) {
      setItems(r.data)
    } else {
      setError(true)
      setItems([])
    }
  }, [customerId, saleId])

  useEffect(() => {
    void load()
  }, [load])

  const when = new Date(atIso).toLocaleString(loc)
  const errMsg = error ? t('debts.saleItems.loadError') : null

  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  function runExportItems() {
    if (items.length === 0) {
      toast.warning(t('common.exportEmpty'))
      return
    }
    const h = toCsvLine([
      t('debts.saleItems.colProduct'),
      t('debts.saleItems.colQty'),
      'unit_price_lbp',
      'line_total_lbp',
    ])
    const body = items.map((l) =>
      toCsvLine([l.productName, l.quantity, l.unitPriceLbp, l.lineTotalLbp]),
    )
    const name = `deken-sale-${saleId.slice(0, 8)}`
    downloadAsCsvFile(name, [h, ...body])
    toast.success(t('common.exportToast'))
  }

  return (
    <div className="ditems-dim" role="presentation" onClick={onBackdrop}>
      <div
        className="ditems-dialog"
        onClick={(e) => e.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-sub`}
      >
        <h2 className="ditems-dialog__title" id={titleId}>
          {t('debts.saleItems.title')}
        </h2>
        <p className="ditems-dialog__sub" id={`${titleId}-sub`}>
          {t('debts.saleItems.subWhen', { when })} — {t('debts.saleItems.subTotal', { n: formatLbp(amountLbp, lng) })}
        </p>
        {loading ? <p className="ditems-dialog__text">{t('debts.saleItems.loading')}</p> : null}
        {errMsg ? (
          <p className="ditems-dialog__err" role="alert">
            {errMsg}
          </p>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <p className="ditems-dialog__text">{t('debts.saleItems.empty')}</p>
        ) : null}
        {!loading && !error && items.length > 0 ? (
          <div className="ditems-table-wrap">
            <table className="ditems-table">
              <thead>
                <tr>
                  <th scope="col">{t('debts.saleItems.colProduct')}</th>
                  <th scope="col" className="ditems-table__num">
                    {t('debts.saleItems.colQty')}
                  </th>
                  <th scope="col" className="ditems-table__num">
                    {t('debts.saleItems.colUnit')}
                  </th>
                  <th scope="col" className="ditems-table__num">
                    {t('debts.saleItems.colLine')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id}>
                    <td className="ditems-table__name">{l.productName}</td>
                    <td className="ditems-table__num">{l.quantity.toLocaleString(loc)}</td>
                    <td className="ditems-table__num">{formatLbp(l.unitPriceLbp, lng)}</td>
                    <td className="ditems-table__num ditems-table__strong">
                      {formatLbp(l.lineTotalLbp, lng)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="ditems-dialog__actions">
          <button
            type="button"
            className="ditems-btn ditems-btn--ghost"
            onClick={runExportItems}
            disabled={loading || error || items.length === 0}
            title={t('common.exportAria')}
            aria-label={t('common.exportAria')}
          >
            <Download size={16} strokeWidth={2} aria-hidden />
            {t('common.export')}
          </button>
          <button type="button" className="ditems-btn ditems-btn--primary" onClick={onClose}>
            {t('debts.saleItems.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
