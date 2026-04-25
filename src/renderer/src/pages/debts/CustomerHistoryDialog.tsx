import { Download } from 'lucide-react'
import { useCallback, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/toast'
import { getCustomerLedger } from '../../lib/api/dekenClient'
import { downloadAsCsvFile, fileDateStamp, toCsvLine } from '../../lib/csvExport'
import { formatLbp } from '../pos/formatPos'
import { DebtSaleItemsDialog } from './DebtSaleItemsDialog'
import type { CustomerBalanceRow, CustomerLedgerLineDto } from '../../../../shared/ipc/types'
import './CustomerHistoryDialog.css'

type Props = {
  row: CustomerBalanceRow
  /** Increment after a successful payment to reload lines for this customer. */
  refreshTrigger: number
  onClose: () => void
}

export function CustomerHistoryDialog({ row, refreshTrigger, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const titleId = useId()
  const lng = i18n.language
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lines, setLines] = useState<CustomerLedgerLineDto[]>([])
  const [saleItems, setSaleItems] = useState<{
    saleId: string
    at: string
    amountLbp: number
  } | null>(null)

  const loc = lng.startsWith('ar') ? 'ar-LB' : 'en-US'

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const r = await getCustomerLedger(row.id)
    setLoading(false)
    if (r.ok) {
      setLines(r.data)
    } else {
      setError(true)
      setLines([])
    }
  }, [row.id])

  useEffect(() => {
    void load()
  }, [load, refreshTrigger])

  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  function runExportLedger() {
    if (lines.length === 0) {
      toast.warning(t('common.exportEmpty'))
      return
    }
    const h = toCsvLine([
      t('debts.ledger.colType'),
      t('debts.ledger.colWhen'),
      'amount_lbp',
      t('debts.ledger.colNote'),
    ])
    const body = lines.map((l) => {
      const isDebt = l.kind === 'debt_sale'
      return toCsvLine([
        isDebt ? t('debts.ledger.typeDebt') : t('debts.ledger.typePayment'),
        l.at,
        l.amountLbp,
        l.note ?? '',
      ])
    })
    const safe = String(row.name).replace(/[^\w\-.]+/g, '_').slice(0, 40) || 'customer'
    downloadAsCsvFile(`deken-ledger-${safe}-${fileDateStamp()}`, [h, ...body])
    toast.success(t('common.exportToast'))
  }

  function openSaleItems(line: CustomerLedgerLineDto) {
    if (line.kind !== 'debt_sale') {
      return
    }
    setSaleItems({ saleId: line.id, at: line.at, amountLbp: line.amountLbp })
  }

  return (
    <>
      <div className="dhist-dim" role="presentation" onClick={onBackdrop}>
        <div
          className="dhist-dialog"
          onClick={(e) => e.stopPropagation()}
          aria-modal="true"
          role="dialog"
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-sub`}
        >
        <h2 className="dhist-dialog__title" id={titleId}>
          {t('debts.ledger.title')}
        </h2>
        <p className="dhist-dialog__sub" id={`${titleId}-sub`}>
          {t('debts.historyDialog.subtitle', { name: row.name })}
        </p>
        {loading ? (
          <p className="dhist-dialog__text">{t('debts.ledger.loading')}</p>
        ) : null}
        {error ? (
          <p className="dhist-dialog__err" role="alert">
            {t('debts.ledger.loadError')}
          </p>
        ) : null}
        {!loading && !error && lines.length === 0 ? (
          <p className="dhist-dialog__text">{t('debts.ledger.empty')}</p>
        ) : null}
        {!loading && !error && lines.length > 0 ? (
          <div className="dhist-ledger-wrap">
            <table className="dhist-ledger">
              <thead>
                <tr>
                  <th scope="col">{t('debts.ledger.colType')}</th>
                  <th scope="col">{t('debts.ledger.colWhen')}</th>
                  <th scope="col" className="dhist-ledger__num">
                    {t('debts.ledger.colAmount')}
                  </th>
                  <th scope="col">{t('debts.ledger.colNote')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const when = new Date(line.at).toLocaleString(loc)
                  const isDebt = line.kind === 'debt_sale'
                  return (
                    <tr
                      key={`${line.kind}-${line.id}`}
                      className={isDebt ? 'dhist-ledger__row dhist-ledger__row--debt' : undefined}
                      tabIndex={isDebt ? 0 : undefined}
                      title={isDebt ? t('debts.ledger.debtRowHint') : undefined}
                      aria-label={isDebt ? t('debts.ledger.debtRowHint') : undefined}
                      onClick={isDebt ? () => openSaleItems(line) : undefined}
                      onKeyDown={
                        isDebt
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openSaleItems(line)
                              }
                            }
                          : undefined
                      }
                    >
                      <td
                        className={
                          isDebt
                            ? 'dhist-ledger__type dhist-ledger__type--debt'
                            : 'dhist-ledger__type dhist-ledger__type--pay'
                        }
                      >
                        {isDebt ? t('debts.ledger.typeDebt') : t('debts.ledger.typePayment')}
                      </td>
                      <td className="dhist-ledger__when">{when}</td>
                      <td className="dhist-ledger__num dhist-ledger__amount">
                        {isDebt
                          ? t('debts.ledger.amountCharge', { n: formatLbp(line.amountLbp, lng) })
                          : t('debts.ledger.amountPayment', { n: formatLbp(line.amountLbp, lng) })}
                      </td>
                      <td className="dhist-ledger__note">
                        {line.note != null && line.note.trim() !== ''
                          ? line.note
                          : t('debts.ledger.noNote')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="dhist-dialog__actions">
          <button
            type="button"
            className="dhist-btn dhist-btn--ghost"
            onClick={runExportLedger}
            disabled={loading || error || lines.length === 0}
            title={t('common.exportAria')}
            aria-label={t('common.exportAria')}
          >
            <Download size={16} strokeWidth={2} aria-hidden />
            {t('common.export')}
          </button>
          <button type="button" className="dhist-btn dhist-btn--primary" onClick={onClose}>
            {t('debts.historyDialog.close')}
          </button>
        </div>
      </div>
    </div>
    {saleItems != null ? (
      <DebtSaleItemsDialog
        customerId={row.id}
        saleId={saleItems.saleId}
        atIso={saleItems.at}
        amountLbp={saleItems.amountLbp}
        onClose={() => {
          setSaleItems(null)
        }}
      />
    ) : null}
    </>
  )
}
