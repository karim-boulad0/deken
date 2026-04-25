import type { Database } from 'better-sqlite3'
import { createHash, createHmac } from 'node:crypto'
import os from 'node:os'
import type {
  ActivationStatusDto,
  IpcErrorShape,
  IpcResult,
  VerifyActivationInput,
} from '../../shared/ipc/types'

const KEY_ACTIVATED = 'license_activated'
const KEY_FINGERPRINT = 'license_fingerprint'
const KEY_ACTIVATED_AT = 'license_activated_at'
const SECRET = 'deken-local-license-v1'

function makeError(code: string, message: string, details?: string): IpcErrorShape {
  return { code, message, details }
}

function asResult<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    if (m === 'activation_invalid_code' || m === 'invalid_input') {
      return { ok: false, error: makeError('validation', m) }
    }
    return { ok: false, error: makeError('internal_error', m) }
  }
}

function readSetting(db: Database, key: string, fallback = ''): string {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? fallback
}

function upsertSetting(db: Database, key: string, value: string): void {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value)
}

function machineFingerprint(): string {
  const cpu = os.cpus()?.[0]?.model ?? ''
  const payload = [
    os.hostname(),
    os.arch(),
    os.platform(),
    cpu,
    String(Math.floor(os.totalmem() / (1024 * 1024))),
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

function machineCodeFromFingerprint(fp: string): string {
  return fp.slice(0, 12).toUpperCase()
}

function expectedActivationCode(machineCode: string): string {
  const sig = createHmac('sha256', SECRET).update(machineCode).digest('hex').slice(0, 6).toUpperCase()
  return `DEKEN-${machineCode}-${sig}`
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

export function getActivationStatus(db: Database): IpcResult<ActivationStatusDto> {
  return asResult(() => {
    const fp = machineFingerprint()
    const machineCode = machineCodeFromFingerprint(fp)
    const activated = readSetting(db, KEY_ACTIVATED, '0').trim()
    const savedFp = readSetting(db, KEY_FINGERPRINT, '').trim()
    return {
      activated: (activated === '1' || activated === 'true') && savedFp === fp,
      machineCode,
    }
  })
}

export function verifyActivation(db: Database, input: VerifyActivationInput): IpcResult<ActivationStatusDto> {
  if (input == null || typeof input.code !== 'string') {
    return { ok: false, error: makeError('validation', 'invalid_input') }
  }
  return asResult(() => {
    const fp = machineFingerprint()
    const machineCode = machineCodeFromFingerprint(fp)
    const expected = expectedActivationCode(machineCode)
    const given = normalizeCode(input.code)
    if (given !== expected) {
      throw new Error('activation_invalid_code')
    }
    upsertSetting(db, KEY_ACTIVATED, '1')
    upsertSetting(db, KEY_FINGERPRINT, fp)
    upsertSetting(db, KEY_ACTIVATED_AT, new Date().toISOString())
    return { activated: true, machineCode }
  })
}
