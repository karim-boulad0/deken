import { randomUUID } from 'node:crypto'
import type {
  ActorRefDto,
  CreateSupplierInput,
  CreateSupplierInvoiceInput,
  CreateSupplierPaymentInput,
  IpcErrorShape,
  IpcResult,
  SupplierBalanceRow,
  SupplierDto,
  SupplierInvoiceDto,
  SupplierPaymentDto,
  UpdateSupplierInput,
} from '../../shared/ipc/types'
import type { Database } from 'better-sqlite3'

const MAX_NAME = 200
const MAX_NOTE = 500
const MAX_REF = 120
const MAX_IMAGE_DATA_URL = 2_500_000

function makeError(code: string, message: string, details?: string): IpcErrorShape {
  return { code, message, details }
}

function asResult<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    if (
      m === 'name_required' ||
      m === 'supplier_not_found' ||
      m === 'amount_invalid' ||
      m === 'invalid_date' ||
      m === 'name_too_long' ||
      m === 'note_too_long' ||
      m === 'reference_too_long' ||
      m === 'invoice_image_too_large' ||
      m === 'invoice_image_invalid'
    ) {
      return { ok: false, error: makeError('validation', m) }
    }
    return { ok: false, error: makeError('internal_error', m) }
  }
}

const ymd = /^\d{4}-\d{2}-\d{2}$/

type SupplierRow = {
  id: string
  name: string
  phone: string | null
  note: string | null
  created_at: string
  updated_at: string
}

function toSupplierDto(r: SupplierRow): SupplierDto {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function actorFromRow(r: {
  actor_id: string | null
  actor_username: string | null
  actor_full_name: string | null
}): ActorRefDto | null {
  if (r.actor_id == null || r.actor_username == null || r.actor_full_name == null) {
    return null
  }
  return { id: r.actor_id, username: r.actor_username, fullName: r.actor_full_name }
}

export function listSupplierBalances(db: Database): IpcResult<SupplierBalanceRow[]> {
  return asResult(() => {
    const st = db.prepare(
      `SELECT
         s.id,
         s.name,
         s.phone,
         s.note,
         s.created_at,
         s.updated_at,
         (
           SELECT COALESCE(SUM(i.amount_lbp), 0)
           FROM supplier_invoices i
           WHERE i.supplier_id = s.id
         ) - (
           SELECT COALESCE(SUM(p.amount_lbp), 0)
           FROM supplier_payments p
           WHERE p.supplier_id = s.id
         ) AS balance_lbp
       FROM suppliers s
       ORDER BY s.name COLLATE NOCASE`,
    )
    const rows = st.all() as (SupplierRow & { balance_lbp: number })[]
    return rows.map((r) => ({
      ...toSupplierDto(r),
      balanceLbp: r.balance_lbp,
    }))
  })
}

export function createSupplier(db: Database, input: CreateSupplierInput): IpcResult<SupplierDto> {
  return asResult(() => {
    const name = (input.name ?? '').trim()
    if (name.length === 0) {
      throw new Error('name_required')
    }
    if (name.length > MAX_NAME) {
      throw new Error('name_too_long')
    }
    const phone =
      input.phone != null && String(input.phone).trim() ? String(input.phone).trim() : null
    const noteRaw = (input.note ?? '').trim()
    if (noteRaw.length > MAX_NOTE) {
      throw new Error('note_too_long')
    }
    const note = noteRaw.length === 0 ? null : noteRaw
    const now = new Date().toISOString()
    const id = randomUUID()
    db.prepare(
      'INSERT INTO suppliers (id, name, phone, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, name, phone, note, now, now)
    return toSupplierDto({
      id,
      name,
      phone,
      note,
      created_at: now,
      updated_at: now,
    })
  })
}

export function updateSupplier(
  db: Database,
  id: string,
  input: UpdateSupplierInput,
): IpcResult<SupplierDto> {
  return asResult(() => {
    const sid = (id ?? '').trim()
    if (!sid) {
      throw new Error('supplier_not_found')
    }
    const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(sid) as SupplierRow | undefined
    if (!row) {
      throw new Error('supplier_not_found')
    }
    let name = row.name
    let phone = row.phone
    let note = row.note
    if (input.name !== undefined) {
      const t = String(input.name).trim()
      if (t.length === 0) {
        throw new Error('name_required')
      }
      if (t.length > MAX_NAME) {
        throw new Error('name_too_long')
      }
      name = t
    }
    if (input.phone !== undefined) {
      phone =
        input.phone != null && String(input.phone).trim() ? String(input.phone).trim() : null
    }
    if (input.note !== undefined) {
      const t = String(input.note ?? '').trim()
      note = t.length === 0 ? null : t
      if (note != null && note.length > MAX_NOTE) {
        throw new Error('note_too_long')
      }
    }
    const now = new Date().toISOString()
    db.prepare('UPDATE suppliers SET name = ?, phone = ?, note = ?, updated_at = ? WHERE id = ?').run(
      name,
      phone,
      note,
      now,
      sid,
    )
    return toSupplierDto({
      ...row,
      name,
      phone,
      note,
      updated_at: now,
    })
  })
}

export function deleteSupplier(db: Database, id: string): IpcResult<null> {
  return asResult(() => {
    const sid = (id ?? '').trim()
    const n = db.prepare('DELETE FROM suppliers WHERE id = ?').run(sid).changes
    if (n !== 1) {
      throw new Error('supplier_not_found')
    }
    return null
  })
}

export function listSupplierInvoices(db: Database, supplierId: string): IpcResult<SupplierInvoiceDto[]> {
  return asResult(() => {
    const sid = (supplierId ?? '').trim()
    if (!sid) {
      throw new Error('supplier_not_found')
    }
    const exists = db.prepare('SELECT 1 FROM suppliers WHERE id = ?').get(sid)
    if (!exists) {
      throw new Error('supplier_not_found')
    }
    const rows = db
      .prepare(
        `SELECT
           i.id,
           i.supplier_id,
           i.invoice_date,
           i.amount_lbp,
           i.reference,
           i.note,
           i.image_data_url,
           i.created_at,
           u.id AS actor_id,
           u.username AS actor_username,
           u.full_name AS actor_full_name
         FROM supplier_invoices i
         LEFT JOIN users u ON u.id = i.created_by_user_id
         WHERE i.supplier_id = ?
         ORDER BY i.invoice_date DESC, i.created_at DESC`,
      )
      .all(sid) as {
      id: string
      supplier_id: string
      invoice_date: string
      amount_lbp: number
      reference: string | null
      note: string | null
      image_data_url: string | null
      created_at: string
      actor_id: string | null
      actor_username: string | null
      actor_full_name: string | null
    }[]
    return rows.map((r) => ({
      id: r.id,
      supplierId: r.supplier_id,
      invoiceDate: r.invoice_date,
      amountLbp: r.amount_lbp,
      reference: r.reference,
      note: r.note,
      imageDataUrl: r.image_data_url,
      createdAt: r.created_at,
      actor: actorFromRow(r),
    }))
  })
}

export function listSupplierPayments(db: Database, supplierId: string): IpcResult<SupplierPaymentDto[]> {
  return asResult(() => {
    const sid = (supplierId ?? '').trim()
    if (!sid) {
      throw new Error('supplier_not_found')
    }
    const exists = db.prepare('SELECT 1 FROM suppliers WHERE id = ?').get(sid)
    if (!exists) {
      throw new Error('supplier_not_found')
    }
    const rows = db
      .prepare(
        `SELECT
           p.id,
           p.supplier_id,
           p.amount_lbp,
           p.created_at,
           p.note,
           u.id AS actor_id,
           u.username AS actor_username,
           u.full_name AS actor_full_name
         FROM supplier_payments p
         LEFT JOIN users u ON u.id = p.created_by_user_id
         WHERE p.supplier_id = ?
         ORDER BY p.created_at DESC`,
      )
      .all(sid) as {
      id: string
      supplier_id: string
      amount_lbp: number
      created_at: string
      note: string | null
      actor_id: string | null
      actor_username: string | null
      actor_full_name: string | null
    }[]
    return rows.map((r) => ({
      id: r.id,
      supplierId: r.supplier_id,
      amountLbp: r.amount_lbp,
      createdAt: r.created_at,
      note: r.note,
      actor: actorFromRow(r),
    }))
  })
}

export function createSupplierInvoice(
  db: Database,
  input: CreateSupplierInvoiceInput,
  actorUserId: string | null,
): IpcResult<SupplierInvoiceDto> {
  return asResult(() => {
    const supplierId = (input.supplierId ?? '').trim()
    const inv = db.prepare('SELECT 1 FROM suppliers WHERE id = ?').get(supplierId)
    if (!inv) {
      throw new Error('supplier_not_found')
    }
    const invoiceDate = (input.invoiceDate ?? '').trim()
    if (!ymd.test(invoiceDate)) {
      throw new Error('invalid_date')
    }
    const amount = Math.floor(Number(input.amountLbp))
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error('amount_invalid')
    }
    const refRaw = (input.reference ?? '').trim()
    const reference = refRaw.length === 0 ? null : refRaw
    if (reference != null && reference.length > MAX_REF) {
      throw new Error('reference_too_long')
    }
    const noteRaw = (input.note ?? '').trim()
    const note = noteRaw.length === 0 ? null : noteRaw
    if (note != null && note.length > MAX_NOTE) {
      throw new Error('note_too_long')
    }
    const imageRaw = (input.imageDataUrl ?? '').trim()
    const imageDataUrl = imageRaw.length === 0 ? null : imageRaw
    if (imageDataUrl != null) {
      if (imageDataUrl.length > MAX_IMAGE_DATA_URL) {
        throw new Error('invoice_image_too_large')
      }
      if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl)) {
        throw new Error('invoice_image_invalid')
      }
    }
    const now = new Date().toISOString()
    const id = randomUUID()
    db.prepare(
      `INSERT INTO supplier_invoices (id, supplier_id, invoice_date, amount_lbp, reference, note, image_data_url, created_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, supplierId, invoiceDate, amount, reference, note, imageDataUrl, now, actorUserId)
    return {
      id,
      supplierId,
      invoiceDate,
      amountLbp: amount,
      reference,
      note,
      imageDataUrl,
      createdAt: now,
      actor: null,
    }
  })
}

export function createSupplierPayment(
  db: Database,
  input: CreateSupplierPaymentInput,
  actorUserId: string | null,
): IpcResult<SupplierPaymentDto> {
  return asResult(() => {
    const supplierId = (input.supplierId ?? '').trim()
    const inv = db.prepare('SELECT 1 FROM suppliers WHERE id = ?').get(supplierId)
    if (!inv) {
      throw new Error('supplier_not_found')
    }
    const amount = Math.floor(Number(input.amountLbp))
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error('amount_invalid')
    }
    const noteRaw = (input.note ?? '').trim()
    const note = noteRaw.length === 0 ? null : noteRaw
    if (note != null && note.length > MAX_NOTE) {
      throw new Error('note_too_long')
    }
    const now = new Date().toISOString()
    const id = randomUUID()
    db.prepare(
      `INSERT INTO supplier_payments (id, supplier_id, amount_lbp, created_at, note, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, supplierId, amount, now, note, actorUserId)
    return {
      id,
      supplierId,
      amountLbp: amount,
      createdAt: now,
      note,
      actor: null,
    }
  })
}
