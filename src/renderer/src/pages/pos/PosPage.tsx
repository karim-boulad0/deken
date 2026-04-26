import { Minus, Plus, ScanBarcode, Trash2, Wallet } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProductDto } from '../../../../shared/ipc/types'
import { useToast } from '../../components/toast'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { completeCashSale, completeDebtSale, findProductByCode, listProducts } from '../../lib/api/dekenClient'
import { DebtRecordDialog, type DebtRecordPayload } from './DebtRecordDialog'
import { formatLbp, formatUsd } from './formatPos'
import { productMatchesLookupCode } from './posLookup'
import './PosPage.css'

type CartLine = {
  id: string
  /** Set when the line is resolved from the local catalog; required for cash checkout. */
  productId?: string
  /** Catalog on-hand when the line was last updated (scan / merge); used to cap quantity. */
  maxStock?: number
  /** Catalog SKU (stable id for the row). */
  sku: string
  /** Full exact value used at lookup (SKU or barcode). Shown in the Code column. */
  matchCode: string
  /** Snapshot of catalog barcode when the line was added/merged; used for tooltips. */
  productBarcode?: string | null
  nameKey: string
  nameParams?: Record<string, string>
  /** When set, shows catalog name (not an i18n key). */
  displayName?: string
  qty: number
  unitPriceLbp: number
}

type ReceiptLine = {
  name: string
  qty: number
  unitPriceLbp: number
}

type PosTicket = {
  id: string
  label: string
  cart: CartLine[]
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw.replace(',', '.').trim())
  if (!Number.isFinite(n) || n <= 0) {
    return null
  }
  return n
}

export function PosPage() {
  const { t, i18n } = useTranslation()
  const { settings } = useAppSettings()
  const lbpPerUsd = settings.lbpPerUsd
  const toast = useToast()
  const lng = i18n.language
  const searchRef = useRef<HTMLInputElement>(null)
  const scannerBufferRef = useRef('')
  const scannerTimerRef = useRef<number | null>(null)
  const cartRegionId = useId()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductDto[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({})
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [tickets, setTickets] = useState<PosTicket[]>(() => [
    { id: newId(), label: '1', cart: [] },
  ])
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [payCashBusy, setPayCashBusy] = useState(false)
  const [payDebtBusy, setPayDebtBusy] = useState(false)
  const [debtOpen, setDebtOpen] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const receiptFrameRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    const tmr = window.setTimeout(() => setLoading(false), 380)
    return () => window.clearTimeout(tmr)
  }, [])

  useEffect(() => {
    if (!loading) {
      searchRef.current?.focus()
    }
  }, [loading])

  useEffect(() => {
    if (activeTicketId == null && tickets.length > 0) {
      setActiveTicketId(tickets[0].id)
    }
  }, [activeTicketId, tickets])

  const activeTicket = useMemo(() => {
    if (tickets.length === 0) {
      return null
    }
    if (activeTicketId == null) {
      return tickets[0]
    }
    return tickets.find((t) => t.id === activeTicketId) ?? tickets[0]
  }, [activeTicketId, tickets])

  const cart = activeTicket?.cart ?? []

  const updateActiveCart = useCallback(
    (updater: (prev: CartLine[]) => CartLine[]) => {
      if (!activeTicket) {
        return
      }
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === activeTicket.id ? { ...ticket, cart: updater(ticket.cart) } : ticket,
        ),
      )
    },
    [activeTicket],
  )

  const totals = useMemo(() => {
    const subLbp = cart.reduce((s, l) => s + l.qty * l.unitPriceLbp, 0)
    const usd = subLbp / lbpPerUsd
    return { subLbp, usd }
  }, [cart, lbpPerUsd])

  const formatted = useMemo(
    () => ({
      subLbp: formatLbp(totals.subLbp, lng),
      usd: formatUsd(totals.usd, lng),
    }),
    [lng, totals.subLbp, totals.usd],
  )

  const codeLineTooltip = useCallback(
    (line: CartLine) => {
      const sku = line.sku
      const m = (line.matchCode || sku).trim()
      const bar = line.productBarcode?.trim() || ''
      if (m.toLowerCase() === sku.toLowerCase() && !bar) {
        return t('pos.cart.codeTooltipSkuOnly', { sku })
      }
      const showBar = bar && m.toLowerCase() !== bar.toLowerCase()
      return t('pos.cart.codeTooltipDetails', {
        match: m,
        sku,
        barcodePart: showBar ? t('pos.cart.codeTooltipBarcodePart', { bar }) : '',
      })
    },
    [t],
  )

  const openSaleReceiptPreview = useCallback(
    (args: {
      lines: ReceiptLine[]
      totalLbp: number
      saleType: 'cash' | 'debt'
      customerName?: string
    }) => {
      const { lines, totalLbp, saleType, customerName } = args
      const now = new Date()
      const when = now.toLocaleString(lng.startsWith('ar') ? 'ar-LB' : 'en-US')
      const paper80 = settings.receiptPaper === '80'
      const widthCss = paper80 ? '80mm' : '210mm'
      const baseFont = paper80 ? '12px' : '13px'
      const shop = settings.shopName.trim() || t('app.defaultBusinessName')
      const lineRows = lines
        .map((l) => {
          const lineTotal = l.qty * l.unitPriceLbp
          return `<tr>
            <td>${escapeHtml(l.name)}</td>
            <td class="n">${l.qty}</td>
            <td class="n">${escapeHtml(formatLbp(l.unitPriceLbp, lng))}</td>
            <td class="n">${escapeHtml(formatLbp(lineTotal, lng))}</td>
          </tr>`
        })
        .join('')
      const html = `<!doctype html>
<html lang="${lng.startsWith('ar') ? 'ar' : 'en'}" dir="${lng.startsWith('ar') ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(t('pos.receipt.title'))}</title>
  <style>
    @page { margin: 8mm; size: ${paper80 ? '80mm auto' : 'A4'}; }
    body { margin: 0; font-family: Arial, sans-serif; font-size: ${baseFont}; color: #111; }
    .r { width: ${widthCss}; max-width: 100%; margin: 0 auto; }
    .h { text-align: center; margin-bottom: 8px; }
    .shop { font-size: 1.15em; font-weight: 700; }
    .meta { margin-top: 4px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border-bottom: 1px solid #ddd; padding: 4px; text-align: start; vertical-align: top; }
    th { font-size: 0.92em; color: #444; }
    .n { text-align: end; white-space: nowrap; }
    .total { margin-top: 10px; font-weight: 700; text-align: end; font-size: 1.05em; }
  </style>
</head>
<body>
  <div class="r">
    <div class="h">
      <div class="shop">${escapeHtml(shop)}</div>
      <div class="meta">${escapeHtml(t('pos.receipt.when', { when }))}</div>
      <div class="meta">${escapeHtml(t(saleType === 'cash' ? 'pos.receipt.saleTypeCash' : 'pos.receipt.saleTypeDebt'))}</div>
      ${
        saleType === 'debt' && customerName
          ? `<div class="meta">${escapeHtml(t('pos.receipt.customer', { name: customerName }))}</div>`
          : ''
      }
    </div>
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(t('pos.receipt.colItem'))}</th>
          <th class="n">${escapeHtml(t('pos.receipt.colQty'))}</th>
          <th class="n">${escapeHtml(t('pos.receipt.colUnit'))}</th>
          <th class="n">${escapeHtml(t('pos.receipt.colLine'))}</th>
        </tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>
    <div class="total">${escapeHtml(t('pos.receipt.total', { total: formatLbp(totalLbp, lng) }))}</div>
  </div>
</body>
</html>`

      setReceiptPreview(html)
    },
    [lng, settings.receiptPaper, settings.shopName, t],
  )

  const runPrintFromPreview = useCallback(() => {
    try {
      const w = receiptFrameRef.current?.contentWindow
      if (!w) {
        return
      }
      w.focus()
      w.print()
    } catch {
      toast.error(t('pos.toast.printOpenFailed'), 5000)
    }
  }, [t, toast])

  const resolveMatchCode = useCallback((rawQuery: string, product: ProductDto) => {
    const q = rawQuery.trim()
    if (q && productMatchesLookupCode(q, product)) {
      return q
    }
    const barcode = product.barcode?.trim()
    return barcode && barcode.length > 0 ? barcode : product.sku
  }, [])

  const addCatalogProduct = useCallback(
    (p: ProductDto, matchCode: string) => {
      if (p.stock <= 0) {
        toast.error(t('pos.toast.addOutOfStock', { name: p.name }), 5000)
        requestAnimationFrame(() => searchRef.current?.focus())
        return
      }

      setQuery('')
      setSearchResults([])
      setSearchError(null)

      updateActiveCart((prev) => {
        const idx = prev.findIndex((l) => l.productId === p.id)
        if (idx >= 0) {
          const line = prev[idx]
          if (line.qty >= p.stock) {
            window.queueMicrotask(() => {
              toast.error(
                t('pos.toast.cannotExceedStock', {
                  max: p.stock,
                  name: p.name,
                }),
                5000,
              )
            })
            return prev
          }
          const next = [...prev]
          next[idx] = {
            ...line,
            qty: line.qty + 1,
            maxStock: p.stock,
            productId: p.id,
            productBarcode: p.barcode ?? null,
            unitPriceLbp: p.priceLbp,
          }
          return next
        }
        return [
          ...prev,
          {
            id: newId(),
            productId: p.id,
            maxStock: p.stock,
            sku: p.sku,
            matchCode,
            productBarcode: p.barcode ?? null,
            nameKey: 'app.name',
            displayName: p.name,
            qty: 1,
            unitPriceLbp: p.priceLbp,
          },
        ]
      })
      requestAnimationFrame(() => searchRef.current?.focus())
    },
    [t, toast, updateActiveCart],
  )

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setSearchResults([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setSearchLoading(true)
      setSearchError(null)
      void (async () => {
        const res = await listProducts(term, null)
        if (cancelled) {
          return
        }
        if (!res.ok) {
          setSearchResults([])
          setSearchError(t('pos.entry.searchFailed'))
          setSearchLoading(false)
          return
        }
        setSearchResults(res.data.slice(0, 8))
        setSearchLoading(false)
      })()
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, t])

  const addByLookupCode = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim()
      if (!code) {
        return
      }

      void (async () => {
        const res = await findProductByCode(code)
        if (!res.ok) {
          toast.error(t('pos.toast.lookupFailed', { message: res.error.message }), 5000)
          requestAnimationFrame(() => searchRef.current?.focus())
          return
        }
        if (!res.data) {
          toast.error(t('pos.toast.unknownCode', { code }), 5000)
          requestAnimationFrame(() => searchRef.current?.focus())
          return
        }
        const p = res.data
        if (!productMatchesLookupCode(code, p)) {
          toast.error(t('pos.toast.unknownCode', { code }), 5000)
          requestAnimationFrame(() => searchRef.current?.focus())
          return
        }
        addCatalogProduct(p, code)
      })()
    },
    [addCatalogProduct, t, toast],
  )

  const addFromQuery = useCallback(() => {
    /* Prefer the live DOM value so we never add using a stale React `query` (fast paste/scan + Add). */
    const code = (searchRef.current?.value ?? query).trim()
    if (!code) {
      return
    }
    addByLookupCode(code)
  }, [addByLookupCode, query])

  useEffect(() => {
    if (loading) {
      return
    }

    const clearScannerBuffer = () => {
      scannerBufferRef.current = ''
      if (scannerTimerRef.current != null) {
        window.clearTimeout(scannerTimerRef.current)
        scannerTimerRef.current = null
      }
    }

    const scheduleBufferClear = () => {
      if (scannerTimerRef.current != null) {
        window.clearTimeout(scannerTimerRef.current)
      }
      scannerTimerRef.current = window.setTimeout(() => {
        scannerBufferRef.current = ''
        scannerTimerRef.current = null
      }, 140)
    }

    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) {
        return
      }
      const target = e.target as HTMLElement | null
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true
      if (isEditableTarget && target !== searchRef.current) {
        return
      }

      if (e.key === 'Enter') {
        const buffered = scannerBufferRef.current.trim()
        if (buffered && document.activeElement !== searchRef.current) {
          e.preventDefault()
          setQuery(buffered)
          addByLookupCode(buffered)
          clearScannerBuffer()
        }
        return
      }

      if (e.key.length === 1 && !e.repeat) {
        const next = `${scannerBufferRef.current}${e.key}`
        scannerBufferRef.current = next
        if (document.activeElement !== searchRef.current) {
          e.preventDefault()
          setQuery(next)
        }
        scheduleBufferClear()
      }
    }

    window.addEventListener('keydown', onGlobalKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onGlobalKeyDown, true)
      clearScannerBuffer()
    }
  }, [addByLookupCode, loading])

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const first = searchResults[0]
      const raw = (searchRef.current?.value ?? query).trim()
      if (raw && first) {
        addCatalogProduct(first, resolveMatchCode(raw, first))
        return
      }
      addFromQuery()
    }
  }

  const updateQty = useCallback(
    (id: string, delta: number) => {
      if (delta === 0) {
        return
      }
      updateActiveCart((prev) =>
        prev
          .map((l) => {
            if (l.id !== id) {
              return l
            }
            const nextQty = l.qty + delta
            if (delta < 0) {
              return { ...l, qty: Math.max(0, nextQty) }
            }
            if (l.productId && l.maxStock != null) {
              if (nextQty > l.maxStock) {
                const label = l.displayName ?? l.sku
                window.queueMicrotask(() => {
                  toast.error(
                    t('pos.toast.cannotExceedStock', {
                      max: l.maxStock!,
                      name: label,
                    }),
                    5000,
                  )
                })
                return { ...l, qty: l.maxStock }
              }
            }
            return { ...l, qty: nextQty }
          })
          .filter((l) => l.qty > 0),
      )
    },
    [t, toast, updateActiveCart],
  )

  const setQty = useCallback(
    (id: string, rawValue: string) => {
      const parsed = parsePositiveNumber(rawValue)
      if (parsed == null) {
        return
      }
      updateActiveCart((prev) =>
        prev
          .map((l) => {
            if (l.id !== id) {
              return l
            }
            let nextQty = parsed
            if (l.productId && l.maxStock != null && nextQty > l.maxStock) {
              const label = l.displayName ?? l.sku
              nextQty = l.maxStock
              window.queueMicrotask(() => {
                toast.error(
                  t('pos.toast.cannotExceedStock', {
                    max: l.maxStock!,
                    name: label,
                  }),
                  5000,
                )
              })
            }
            return { ...l, qty: nextQty }
          })
          .filter((l) => l.qty > 0),
      )
    },
    [t, toast, updateActiveCart],
  )

  const setUnitPrice = useCallback(
    (id: string, rawValue: string) => {
      const parsed = parsePositiveNumber(rawValue)
      if (parsed == null) {
        return
      }
      updateActiveCart((prev) =>
        prev.map((l) => (l.id === id ? { ...l, unitPriceLbp: parsed } : l)),
      )
    },
    [updateActiveCart],
  )

  function removeLine(id: string) {
    updateActiveCart((prev) => prev.filter((l) => l.id !== id))
  }

  function clearCart() {
    updateActiveCart(() => [])
  }

  const cartHasUnlinkedLines = useMemo(
    () => cart.length > 0 && cart.some((l) => l.productId == null),
    [cart],
  )

  function mapCashError(message: string) {
    const m = message.trim()
    if (m === 'empty_lines') {
      return t('pos.errors.cashEmpty')
    }
    if (m === 'insufficient_stock') {
      return t('pos.errors.cashInsufficientStock')
    }
    if (m === 'product_not_found') {
      return t('pos.errors.cashNotFound')
    }
    if (m === 'invalid_line') {
      return t('pos.errors.cashInvalid')
    }
    return t('pos.errors.cashGeneric', { message: m })
  }

  function handlePayCash() {
    if (cart.length === 0 || cartHasUnlinkedLines || payCashBusy || !activeTicket) {
      return
    }
    const lines: { productId: string; quantity: number; unitPriceLbp?: number }[] = []
    for (const l of cart) {
      if (!l.productId) {
        return
      }
      lines.push({
        productId: l.productId,
        quantity: l.qty,
        unitPriceLbp: l.unitPriceLbp,
      })
    }
    if (lines.length === 0) {
      return
    }

    void (async () => {
      setPayCashBusy(true)
      const r = await completeCashSale(lines)
      setPayCashBusy(false)
      if (r.ok) {
        const receiptLines: ReceiptLine[] = cart.map((l) => ({
          name: l.displayName ?? (l.nameParams ? t(l.nameKey, l.nameParams) : t(l.nameKey)),
          qty: l.qty,
          unitPriceLbp: l.unitPriceLbp,
        }))
        setTickets((prev) =>
          prev.map((ticket) => (ticket.id === activeTicket.id ? { ...ticket, cart: [] } : ticket)),
        )
        toast.success(
          t('pos.toast.paidCashRecorded', {
            total: formatLbp(r.data.totalLbp, lng),
          }),
          5000,
        )
        if (settings.printReceiptAfterSale) {
          openSaleReceiptPreview({
            lines: receiptLines,
            totalLbp: r.data.totalLbp,
            saleType: 'cash',
          })
        }
      } else {
        toast.error(mapCashError(r.error.message), 6000)
      }
    })()
  }

  const handleDebtConfirm = useCallback(
    (payload: DebtRecordPayload) => {
      if (cart.length === 0 || cartHasUnlinkedLines || payDebtBusy || !activeTicket) {
        return false
      }
      const lines: { productId: string; quantity: number; unitPriceLbp?: number }[] = []
      for (const l of cart) {
        if (!l.productId) {
          return false
        }
        lines.push({
          productId: l.productId,
          quantity: l.qty,
          unitPriceLbp: l.unitPriceLbp,
        })
      }
      if (lines.length === 0) {
        return false
      }

      const input =
        payload.mode === 'existing' && payload.debtorId
          ? {
              mode: 'existing' as const,
              customerId: payload.debtorId,
              note: payload.note,
              lines,
            }
          : {
              mode: 'new' as const,
              customerName: payload.customerName,
              customerPhone: payload.customerPhone,
              note: payload.note,
              lines,
            }

      return (async () => {
        setPayDebtBusy(true)
        const r = await completeDebtSale(input)
        setPayDebtBusy(false)
        if (r.ok) {
          const receiptLines: ReceiptLine[] = cart.map((l) => ({
            name: l.displayName ?? (l.nameParams ? t(l.nameKey, l.nameParams) : t(l.nameKey)),
            qty: l.qty,
            unitPriceLbp: l.unitPriceLbp,
          }))
          setTickets((prev) =>
            prev.map((ticket) => (ticket.id === activeTicket.id ? { ...ticket, cart: [] } : ticket)),
          )
          const noteT = payload.note.trim()
          toast.success(
            noteT
              ? t('pos.toast.paidDebtRecordedNote', {
                  total: formatLbp(r.data.totalLbp, lng),
                  name: payload.customerName,
                  note: noteT,
                })
              : t('pos.toast.paidDebtRecorded', {
                  total: formatLbp(r.data.totalLbp, lng),
                  name: payload.customerName,
                }),
            6000,
          )
          if (settings.printReceiptAfterSale) {
            openSaleReceiptPreview({
              lines: receiptLines,
              totalLbp: r.data.totalLbp,
              saleType: 'debt',
              customerName: payload.customerName,
            })
          }
          return true
        }
        const m = r.error.message.trim()
        if (m === 'empty_lines') {
          toast.error(t('pos.errors.debtEmpty'), 6000)
        } else if (m === 'insufficient_stock') {
          toast.error(t('pos.errors.cashInsufficientStock'), 6000)
        } else if (m === 'product_not_found') {
          toast.error(t('pos.errors.cashNotFound'), 6000)
        } else if (m === 'invalid_line') {
          toast.error(t('pos.errors.cashInvalid'), 6000)
        } else if (m === 'customer_not_found') {
          toast.error(t('pos.errors.debtCustomerNotFound'), 6000)
        } else if (m === 'name_required') {
          toast.error(t('pos.debt.errors.nameRequired'), 6000)
        } else {
          toast.error(t('pos.errors.debtGeneric', { message: m }), 6000)
        }
        return false
      })() as Promise<boolean>
    },
    [
      activeTicket,
      cart,
      cartHasUnlinkedLines,
      lng,
      openSaleReceiptPreview,
      payDebtBusy,
      settings.printReceiptAfterSale,
      t,
      toast,
    ],
  )

  const createNewTicket = useCallback(() => {
    setTickets((prev) => {
      const nextNumber = prev.length + 1
      const newTicket: PosTicket = { id: newId(), label: String(nextNumber), cart: [] }
      setActiveTicketId(newTicket.id)
      return [...prev, newTicket]
    })
    setQuery('')
    setSearchResults([])
    setSearchError(null)
  }, [])

  useEffect(() => {
    if (!activeTicket && tickets.length > 0) {
      setActiveTicketId(tickets[0].id)
      return
    }
    if (tickets.length > 0 && activeTicketId != null && !tickets.some((t) => t.id === activeTicketId)) {
      setActiveTicketId(tickets[0].id)
    }
  }, [activeTicket, activeTicketId, tickets])

  const closeTicket = useCallback(
    (ticketId: string) => {
      if (tickets.length <= 1) {
        return
      }
      setTickets((prev) => prev.filter((t) => t.id !== ticketId))
      if (activeTicketId === ticketId) {
        const idx = tickets.findIndex((t) => t.id === ticketId)
        const fallback = tickets[idx - 1] ?? tickets[idx + 1] ?? tickets[0]
        if (fallback) {
          setActiveTicketId(fallback.id)
        }
      }
      setQuery('')
      setSearchResults([])
      setSearchError(null)
    },
    [activeTicketId, tickets],
  )

  const cartActionsDisabled = cart.length === 0
  const payCashDisabled =
    cartActionsDisabled || cartHasUnlinkedLines || payCashBusy
  const payDebtDisabled =
    cartActionsDisabled || cartHasUnlinkedLines || payDebtBusy

  return (
    <div className={`pos${loading ? ' pos--loading' : ''}`}>
      <header className="pos__toolbar">
        <div className="pos__toolbar-main">
          <h1 className="pos__title">{t('pos.pageTitle')}</h1>
          <p className="pos__rate" aria-live="polite">
            {t('pos.toolbar.rateLabel', {
              rate: lbpPerUsd.toLocaleString(lng.startsWith('ar') ? 'ar-LB' : 'en-US'),
            })}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="pos-skeleton" aria-busy="true" aria-label={t('pos.loading.aria')}>
          <div className="pos-skeleton__row" />
          <div className="pos-skeleton__row" />
          <div className="pos-skeleton__row pos-skeleton__row--short" />
        </div>
      ) : (
        <div className="pos__body">
          <section className="pos-panel pos-panel--entry" aria-labelledby="pos-entry-title">
            <h2 className="pos-panel__title" id="pos-entry-title">
              {t('pos.entry.title')}
            </h2>
            <div className="pos-ticket-tabs" aria-label={t('pos.tickets.aria')}>
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className={`pos-ticket-tab${activeTicket?.id === ticket.id ? ' pos-ticket-tab--active' : ''}`}
                  onClick={() => {
                    setActiveTicketId(ticket.id)
                    requestAnimationFrame(() => searchRef.current?.focus())
                  }}
                >
                  <span>{t('pos.tickets.ticketLabel', { n: ticket.label })}</span>
                  {tickets.length > 1 ? (
                    <span
                      className="pos-ticket-tab__close"
                      role="button"
                      aria-label={t('pos.tickets.close')}
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTicket(ticket.id)
                      }}
                    >
                      ×
                    </span>
                  ) : null}
                </button>
              ))}
              <button type="button" className="pos-ticket-tab pos-ticket-tab--new" onClick={createNewTicket}>
                + {t('pos.tickets.new')}
              </button>
            </div>
            <div className="pos-search">
              <label className="pos-search__label" htmlFor="pos-barcode-input">
                {t('pos.entry.fieldLabel')}
              </label>
              <div className="pos-search__row">
                <span className="pos-search__icon" aria-hidden>
                  <ScanBarcode size={22} strokeWidth={2} />
                </span>
                <input
                  id="pos-barcode-input"
                  ref={searchRef}
                  className="pos-search__input"
                  type="text"
                  inputMode="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t('pos.entry.placeholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                />
                <button type="button" className="pos-btn pos-btn--secondary" onClick={addFromQuery}>
                  {t('pos.entry.add')}
                </button>
              </div>
              {query.trim() ? (
                <div className="pos-search-results" role="status" aria-live="polite">
                  {searchLoading ? (
                    <p className="pos-search-results__state">{t('pos.entry.searchLoading')}</p>
                  ) : searchError ? (
                    <p className="pos-search-results__state pos-search-results__state--error">{searchError}</p>
                  ) : searchResults.length === 0 ? (
                    <p className="pos-search-results__state">{t('pos.entry.searchNoResults')}</p>
                  ) : (
                    <>
                      <p className="pos-search-results__count">
                        {t('pos.entry.searchResultsCount', { count: searchResults.length })}
                      </p>
                      <ul className="pos-search-results__list">
                        {searchResults.map((product) => {
                          const inStock = product.stock > 0
                          const attrs = [product.category?.name, product.size?.name, product.flavor?.name]
                            .filter((v): v is string => Boolean(v && v.trim()))
                            .join(' • ')
                          return (
                            <li key={product.id}>
                              <button
                                type="button"
                                className="pos-search-result"
                                disabled={!inStock}
                                onClick={() =>
                                  addCatalogProduct(product, resolveMatchCode(query, product))
                                }
                              >
                                <span className="pos-search-result__head">
                                  <span className="pos-search-result__main">{product.name}</span>
                                  <span className="pos-search-result__id">
                                    {t('pos.entry.idLabel')}: {product.sku}
                                  </span>
                                </span>
                                <span className="pos-search-result__meta">
                                  {product.barcode ? `${t('pos.entry.barcodeLabel')}: ${product.barcode}` : ''}
                                  {attrs ? ` • ${attrs}` : ''}
                                </span>
                                <span className="pos-search-result__stats">
                                  <span>
                                    {inStock
                                      ? t('pos.entry.searchStock', { stock: product.stock })
                                      : t('pos.entry.searchOutOfStock')}
                                  </span>
                                  <strong>{formatLbp(product.priceLbp, lng)}</strong>
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          <div className="pos__stack">
            <section className="pos-summary" aria-labelledby="pos-summary-title">
              <h2 className="pos-visually-hidden" id="pos-summary-title">
                {t('pos.summary.title')}
              </h2>
              <div className="pos-summary__rows">
                <div className="pos-summary__row">
                  <span>{t('pos.summary.subtotal')}</span>
                  <span className="pos-summary__value">{formatted.subLbp}</span>
                </div>
                <div className="pos-summary__row pos-summary__row--accent">
                  <span>{t('pos.summary.totalLbp')}</span>
                  <span className="pos-summary__value">{formatted.subLbp}</span>
                </div>
                <div className="pos-summary__row">
                  <span>{t('pos.summary.totalUsd')}</span>
                  <span className="pos-summary__value">{formatted.usd}</span>
                </div>
              </div>
              <div className="pos-summary__actions">
                <button
                  type="button"
                  className="pos-btn pos-btn--primary pos-btn--checkout"
                  disabled={payCashDisabled}
                  title={cartHasUnlinkedLines ? t('pos.summary.payCashBlockedUnknown') : undefined}
                  onClick={handlePayCash}
                >
                  {t('pos.summary.payCash')}
                </button>
                <button
                  type="button"
                  className="pos-btn pos-btn--debt pos-btn--checkout"
                  disabled={payDebtDisabled}
                  title={cartHasUnlinkedLines ? t('pos.summary.payCashBlockedUnknown') : undefined}
                  onClick={() => setDebtOpen(true)}
                >
                  <Wallet size={16} strokeWidth={2} aria-hidden className="pos-btn__icon" />
                  {t('pos.summary.payDebt')}
                </button>
              </div>
            </section>

            <section
              className="pos-panel pos-panel--cart"
              aria-labelledby="pos-cart-title"
              id={cartRegionId}
            >
              <div className="pos-panel__head">
                <h2 className="pos-panel__title" id="pos-cart-title">
                  {t('pos.cart.title')}
                </h2>
                {cart.length > 0 ? (
                  <button type="button" className="pos-link" onClick={clearCart}>
                    {t('pos.cart.clear')}
                  </button>
                ) : null}
              </div>

              {cart.length === 0 ? (
                <div className="pos-empty" role="status">
                  <div className="pos-empty__icon" aria-hidden>
                    <ScanBarcode size={36} strokeWidth={1.5} />
                  </div>
                  <p className="pos-empty__title">{t('pos.cart.emptyTitle')}</p>
                  <p className="pos-empty__text">{t('pos.cart.emptyBody')}</p>
                </div>
              ) : (
                <div className="pos-table-wrap">
                  <table className="pos-table">
                    <colgroup>
                      <col className="pos-table__col-product" />
                      <col className="pos-table__col-sku" />
                      <col className="pos-table__col-qty" />
                      <col className="pos-table__col-price" />
                      <col className="pos-table__col-line" />
                      <col className="pos-table__col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">{t('pos.cart.colProduct')}</th>
                        <th scope="col">{t('pos.cart.colSku')}</th>
                        <th scope="col" className="pos-table__num">
                          {t('pos.cart.colQty')}
                        </th>
                        <th scope="col" className="pos-table__num">
                          {t('pos.cart.colPrice')}
                        </th>
                        <th scope="col" className="pos-table__num">
                          {t('pos.cart.colLine')}
                        </th>
                        <th scope="col">
                          <span className="pos-visually-hidden">{t('pos.cart.colActions')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((line) => {
                        const lineTotal = line.qty * line.unitPriceLbp
                        const label =
                          line.displayName != null
                            ? line.displayName
                            : line.nameParams
                              ? t(line.nameKey, line.nameParams)
                              : t(line.nameKey)
                        const atMax =
                          line.productId != null &&
                          line.maxStock != null &&
                          line.qty >= line.maxStock
                        return (
                          <tr key={line.id}>
                            <td className="pos-table__cell-truncate">
                              <span className="pos-table__ellipsis" title={label}>
                                {label}
                              </span>
                            </td>
                            <td className="pos-table__cell-sku">
                              <code className="pos-code" title={codeLineTooltip(line)}>
                                {line.matchCode}
                              </code>
                            </td>
                            <td className="pos-table__cell-qty pos-table__num">
                              <div className="pos-qty">
                                <button
                                  type="button"
                                  className="pos-qty__btn"
                                  onClick={() => updateQty(line.id, -1)}
                                  aria-label={t('pos.cart.decQty')}
                                >
                                  <Minus size={16} strokeWidth={2} aria-hidden />
                                </button>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="pos-qty__input"
                                  value={qtyDrafts[line.id] ?? String(line.qty)}
                                  aria-label={t('pos.cart.colQty')}
                                  onChange={(e) => {
                                    const value = e.currentTarget.value
                                    setQtyDrafts((prev) => ({ ...prev, [line.id]: value }))
                                    if (parsePositiveNumber(value) != null) {
                                      setQty(line.id, value)
                                    }
                                  }}
                                  onBlur={(e) => {
                                    setQty(line.id, e.currentTarget.value)
                                    setQtyDrafts((prev) => {
                                      const next = { ...prev }
                                      delete next[line.id]
                                      return next
                                    })
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setQty(line.id, e.currentTarget.value)
                                      setQtyDrafts((prev) => {
                                        const next = { ...prev }
                                        delete next[line.id]
                                        return next
                                      })
                                      e.currentTarget.blur()
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="pos-qty__btn"
                                  disabled={atMax}
                                  title={atMax ? t('pos.cart.maxQtyTitle', { max: line.maxStock ?? 0 }) : undefined}
                                  onClick={() => updateQty(line.id, 1)}
                                  aria-label={t('pos.cart.incQty')}
                                >
                                  <Plus size={16} strokeWidth={2} aria-hidden />
                                </button>
                              </div>
                            </td>
                            <td className="pos-table__cell-money pos-table__num">
                              <input
                                type="text"
                                inputMode="decimal"
                                className="pos-money-input"
                                  value={priceDrafts[line.id] ?? String(line.unitPriceLbp)}
                                aria-label={t('pos.cart.colPrice')}
                                  onChange={(e) => {
                                    const value = e.currentTarget.value
                                    setPriceDrafts((prev) => ({ ...prev, [line.id]: value }))
                                    if (parsePositiveNumber(value) != null) {
                                      setUnitPrice(line.id, value)
                                    }
                                  }}
                                onBlur={(e) => {
                                  setUnitPrice(line.id, e.currentTarget.value)
                                    setPriceDrafts((prev) => {
                                      const next = { ...prev }
                                      delete next[line.id]
                                      return next
                                    })
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setUnitPrice(line.id, e.currentTarget.value)
                                      setPriceDrafts((prev) => {
                                        const next = { ...prev }
                                        delete next[line.id]
                                        return next
                                      })
                                    e.currentTarget.blur()
                                  }
                                }}
                              />
                            </td>
                            <td className="pos-table__cell-money pos-table__num pos-table__strong">
                              {formatLbp(lineTotal, lng)}
                            </td>
                            <td className="pos-table__cell-actions">
                              <button
                                type="button"
                                className="pos-iconbtn"
                                onClick={() => removeLine(line.id)}
                                aria-label={t('pos.cart.removeLine')}
                              >
                                <Trash2 size={18} strokeWidth={2} aria-hidden />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      <DebtRecordDialog
        open={debtOpen}
        onOpenChange={setDebtOpen}
        totalLbpDisplay={formatted.subLbp}
        totalUsdDisplay={formatted.usd}
        lineCount={cart.length}
        onConfirm={handleDebtConfirm}
      />

      {receiptPreview != null ? (
        <div
          className="pos-rprev-dim"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setReceiptPreview(null)
            }
          }}
        >
          <section className="pos-rprev" role="dialog" aria-modal="true" aria-label={t('pos.receipt.previewTitle')}>
            <header className="pos-rprev__head">
              <h3 className="pos-rprev__title">{t('pos.receipt.previewTitle')}</h3>
            </header>
            <div className="pos-rprev__frame-wrap">
              <iframe
                ref={receiptFrameRef}
                className="pos-rprev__frame"
                title={t('pos.receipt.previewTitle')}
                srcDoc={receiptPreview}
              />
            </div>
            <div className="pos-rprev__actions">
              <button type="button" className="pos-btn pos-btn--secondary" onClick={() => setReceiptPreview(null)}>
                {t('pos.receipt.closePreview')}
              </button>
              <button type="button" className="pos-btn pos-btn--primary" onClick={runPrintFromPreview}>
                {t('pos.receipt.printNow')}
              </button>
            </div>
          </section>
        </div>
      ) : null}

    </div>
  )
}
