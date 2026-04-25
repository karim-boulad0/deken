import { Download } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../components/toast'
import { listSupplierInvoices, listSupplierPayments } from '../../lib/api/dekenClient'
import { downloadAsCsvFile, fileDateStamp, toCsvLine } from '../../lib/csvExport'
import { formatLbp } from '../pos/formatPos'
import type { SupplierBalanceRow, SupplierInvoiceDto, SupplierPaymentDto } from '../../../../shared/ipc/types'
import '../debts/CustomerHistoryDialog.css'

type Props = {
  row: SupplierBalanceRow
  refreshTrigger: number
  onClose: () => void
}

type LedgerLine = {
  key: string
  kind: 'invoice' | 'payment'
  sortAt: string
  whenDisplay: string
  amountLbp: number
  detail: string
  invoice?: SupplierInvoiceDto
  payment?: SupplierPaymentDto
}

function mergeLines(
  invoices: SupplierInvoiceDto[],
  payments: SupplierPaymentDto[],
  loc: string,
): LedgerLine[] {
  const invLines: LedgerLine[] = invoices.map((inv) => {
    const d = new Date(`${inv.invoiceDate}T12:00:00`)
    const whenDisplay = Number.isNaN(d.getTime())
      ? inv.invoiceDate
      : d.toLocaleDateString(loc, { year: 'numeric', month: 'short', day: 'numeric' })
    const parts = [inv.reference?.trim(), inv.note?.trim()].filter((s) => s != null && s !== '') as string[]
    return {
      key: `inv-${inv.id}`,
      kind: 'invoice',
      sortAt: inv.createdAt,
      whenDisplay,
      amountLbp: inv.amountLbp,
      detail: parts.length > 0 ? parts.join(' · ') : '',
      invoice: inv,
    }
  })
  const payLines: LedgerLine[] = payments.map((p) => {
    return {
      key: `pay-${p.id}`,
      kind: 'payment',
      sortAt: p.createdAt,
      whenDisplay: new Date(p.createdAt).toLocaleString(loc),
      amountLbp: p.amountLbp,
      detail: p.note?.trim() ?? '',
      payment: p,
    }
  })
  const all = [...invLines, ...payLines]
  all.sort((a, b) => (a.sortAt < b.sortAt ? 1 : a.sortAt > b.sortAt ? -1 : 0))
  return all
}

export function SupplierHistoryDialog({ row, refreshTrigger, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const titleId = useId()
  const lng = i18n.language
  const loc = lng.startsWith('ar') ? 'ar-LB' : 'en-US'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [invoices, setInvoices] = useState<SupplierInvoiceDto[]>([])
  const [payments, setPayments] = useState<SupplierPaymentDto[]>([])
  const [selectedLineKey, setSelectedLineKey] = useState<string | null>(null)

  const lines = useMemo(() => mergeLines(invoices, payments, loc), [invoices, payments, loc])
  const selectedLine = useMemo(
    () => lines.find((l) => l.key === selectedLineKey) ?? null,
    [lines, selectedLineKey],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const [ri, rp] = await Promise.all([listSupplierInvoices(row.id), listSupplierPayments(row.id)])
    setLoading(false)
    if (ri.ok && rp.ok) {
      setInvoices(ri.data)
      setPayments(rp.data)
      const firstKey = ri.data.length > 0 || rp.data.length > 0 ? mergeLines(ri.data, rp.data, loc)[0]?.key : null
      setSelectedLineKey((prev) => prev ?? firstKey ?? null)
    } else {
      setError(true)
      setInvoices([])
      setPayments([])
      setSelectedLineKey(null)
    }
  }, [loc, row.id])

  useEffect(() => {
    void load()
  }, [load, refreshTrigger])

  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  function runExport() {
    if (lines.length === 0) {
      toast.warning(t('common.exportEmpty'))
      return
    }
    const h = toCsvLine([
      t('suppliers.ledger.colType'),
      t('suppliers.ledger.colWhen'),
      'amount_lbp_signed',
      t('suppliers.ledger.colDetail'),
    ])
    const body = lines.map((l) =>
      toCsvLine([
        l.kind === 'invoice' ? t('suppliers.ledger.typeInvoice') : t('suppliers.ledger.typePayment'),
        l.whenDisplay,
        l.kind === 'invoice' ? l.amountLbp : -l.amountLbp,
        l.detail,
      ]),
    )
    const safe = String(row.name).replace(/[^\w\-.]+/g, '_').slice(0, 40) || 'supplier'
    downloadAsCsvFile(`deken-supplier-ledger-${safe}-${fileDateStamp()}`, [h, ...body])
    toast.success(t('common.exportToast'))
  }

  return (
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
          {t('suppliers.ledger.title')}
        </h2>
        <p className="dhist-dialog__sub" id={`${titleId}-sub`}>
          {t('suppliers.historyDialog.subtitle', { name: row.name })}
        </p>
        {loading ? <p className="dhist-dialog__text">{t('suppliers.ledger.loading')}</p> : null}
        {error ? (
          <p className="dhist-dialog__err" role="alert">
            {t('suppliers.ledger.loadError')}
          </p>
        ) : null}
        {!loading && !error && lines.length === 0 ? (
          <p className="dhist-dialog__text">{t('suppliers.ledger.empty')}</p>
        ) : null}
        {!loading && !error && lines.length > 0 ? (
          <div className="dhist-sup-grid">
            <div className="dhist-ledger-wrap">
              <table className="dhist-ledger">
                <thead>
                  <tr>
                    <th scope="col">{t('suppliers.ledger.colType')}</th>
                    <th scope="col">{t('suppliers.ledger.colWhen')}</th>
                    <th scope="col" className="dhist-ledger__num">
                      {t('suppliers.ledger.colAmount')}
                    </th>
                    <th scope="col">{t('suppliers.ledger.colDetail')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const isInv = line.kind === 'invoice'
                    const selected = line.key === selectedLineKey
                    return (
                      <tr
                        key={line.key}
                        className={selected ? 'dhist-ledger__row--debt' : undefined}
                        onClick={() => setSelectedLineKey(line.key)}
                      >
                        <td
                          className={
                            isInv
                              ? 'dhist-ledger__type dhist-ledger__type--debt'
                              : 'dhist-ledger__type dhist-ledger__type--pay'
                          }
                        >
                          {isInv ? t('suppliers.ledger.typeInvoice') : t('suppliers.ledger.typePayment')}
                        </td>
                        <td className="dhist-ledger__when">{line.whenDisplay}</td>
                        <td className="dhist-ledger__num dhist-ledger__amount">
                          {isInv
                            ? t('suppliers.ledger.amountInvoice', { n: formatLbp(line.amountLbp, lng) })
                            : t('suppliers.ledger.amountPayment', { n: formatLbp(line.amountLbp, lng) })}
                        </td>
                        <td className="dhist-ledger__note">
                          {line.detail !== '' ? line.detail : t('suppliers.ledger.noDetail')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {selectedLine != null ? (
              <section className="dhist-detail" aria-label={t('suppliers.ledger.detailTitle')}>
                <h3 className="dhist-detail__title">{t('suppliers.ledger.detailTitle')}</h3>
                <div className="dhist-detail__grid">
                  <div>
                    <span className="dhist-detail__label">{t('suppliers.ledger.colType')}</span>
                    <p className="dhist-detail__value">
                      {selectedLine.kind === 'invoice'
                        ? t('suppliers.ledger.typeInvoice')
                        : t('suppliers.ledger.typePayment')}
                    </p>
                  </div>
                  <div>
                    <span className="dhist-detail__label">{t('suppliers.ledger.colWhen')}</span>
                    <p className="dhist-detail__value">{selectedLine.whenDisplay}</p>
                  </div>
                  <div>
                    <span className="dhist-detail__label">{t('suppliers.ledger.colAmount')}</span>
                    <p className="dhist-detail__value">
                      {selectedLine.kind === 'invoice'
                        ? t('suppliers.ledger.amountInvoice', { n: formatLbp(selectedLine.amountLbp, lng) })
                        : t('suppliers.ledger.amountPayment', { n: formatLbp(selectedLine.amountLbp, lng) })}
                    </p>
                  </div>
                  {selectedLine.invoice?.reference ? (
                    <div>
                      <span className="dhist-detail__label">{t('suppliers.invoice.reference')}</span>
                      <p className="dhist-detail__value">{selectedLine.invoice.reference}</p>
                    </div>
                  ) : null}
                  {selectedLine.detail ? (
                    <div className="dhist-detail__full">
                      <span className="dhist-detail__label">
                        {selectedLine.kind === 'invoice'
                          ? t('suppliers.invoice.note')
                          : t('suppliers.payment.note')}
                      </span>
                      <p className="dhist-detail__value">{selectedLine.detail}</p>
                    </div>
                  ) : null}
                </div>
                <div className="dhist-detail__image-wrap">
                  <span className="dhist-detail__label">{t('suppliers.ledger.attachment')}</span>
                  {selectedLine.invoice?.imageDataUrl ? (
                    <img
                      src={selectedLine.invoice.imageDataUrl}
                      alt={t('suppliers.invoice.imagePreviewAlt')}
                      className="dhist-detail__image"
                    />
                  ) : (
                    <p className="dhist-detail__value">{t('suppliers.ledger.noAttachment')}</p>
                  )}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
        <div className="dhist-dialog__actions">
          <button
            type="button"
            className="dhist-btn dhist-btn--ghost"
            onClick={runExport}
            disabled={loading || error || lines.length === 0}
            title={t('common.exportAria')}
            aria-label={t('common.exportAria')}
          >
            <Download size={16} strokeWidth={2} aria-hidden />
            {t('common.export')}
          </button>
          <button type="button" className="dhist-btn dhist-btn--primary" onClick={onClose}>
            {t('suppliers.historyDialog.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
