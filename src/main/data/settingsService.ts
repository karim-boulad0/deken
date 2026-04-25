import type {
  AppNavLayout,
  AppSettingsDto,
  IpcErrorShape,
  IpcResult,
  UpdateAppSettingsInput,
} from '../../shared/ipc/types'
import type { Database } from 'better-sqlite3'

function makeError(code: string, message: string, details?: string): IpcErrorShape {
  return { code, message, details }
}

function asResult<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    if (m === 'lbp_per_usd_invalid' || m === 'shop_name_too_long' || m === 'nav_layout_invalid') {
      return { ok: false, error: makeError('validation', m) }
    }
    return { ok: false, error: makeError('internal_error', m) }
  }
}

const KEY_LBP = 'lbp_per_usd'
const KEY_SHOP = 'shop_name'
const KEY_CLASSIC = 'show_classic_menu'
const KEY_NAV_LAYOUT = 'nav_layout'
const MAX_SHOP = 200

const DEFAULT_LBP = 89_500

export function getAppSettings(db: Database): IpcResult<AppSettingsDto> {
  return asResult(() => {
    const st = db.prepare('SELECT value FROM app_settings WHERE key = ?')
    const rawLbp = readRowValue(st, KEY_LBP, String(DEFAULT_LBP))
    const n = Math.floor(Number(rawLbp))
    const lbpPerUsd =
      rawLbp.trim() === '' || Number.isNaN(n) || n < 1
        ? DEFAULT_LBP
        : n > 100_000_000
          ? 100_000_000
          : n
    const shopName = readRowValue(st, KEY_SHOP, '')
    const rawClassic = readRowValue(st, KEY_CLASSIC, '0').trim()
    const showClassicMenu = rawClassic === '1' || rawClassic === 'true'
    const navLayout: AppNavLayout = parseNavLayout(readRowValue(st, KEY_NAV_LAYOUT, 'sidebar'))
    return {
      shopName: shopName.length > MAX_SHOP ? shopName.slice(0, MAX_SHOP) : shopName,
      lbpPerUsd,
      showClassicMenu,
      navLayout,
    }
  })
}

function parseNavLayout(s: string): AppNavLayout {
  const t = s.trim().toLowerCase()
  if (t === 'top') {
    return 'top'
  }
  return 'sidebar'
}

export function setAppSettings(db: Database, input: UpdateAppSettingsInput): IpcResult<AppSettingsDto> {
  if (
    input.shopName === undefined &&
    input.lbpPerUsd === undefined &&
    input.showClassicMenu === undefined &&
    input.navLayout === undefined
  ) {
    return getAppSettings(db)
  }
  if (input.lbpPerUsd !== undefined) {
    if (!Number.isInteger(input.lbpPerUsd) || input.lbpPerUsd < 1) {
      return { ok: false, error: makeError('validation', 'lbp_per_usd_invalid') }
    }
    if (input.lbpPerUsd > 100_000_000) {
      return { ok: false, error: makeError('validation', 'lbp_per_usd_invalid') }
    }
  }
  if (input.shopName !== undefined && input.shopName.length > MAX_SHOP) {
    return { ok: false, error: makeError('validation', 'shop_name_too_long') }
  }
  if (input.navLayout !== undefined && input.navLayout !== 'sidebar' && input.navLayout !== 'top') {
    return { ok: false, error: makeError('validation', 'nav_layout_invalid') }
  }
  return asResult(() => {
    const stUpsert = db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (@k, @v)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    if (input.shopName !== undefined) {
      stUpsert.run({ k: KEY_SHOP, v: input.shopName.trim() })
    }
    if (input.lbpPerUsd !== undefined) {
      stUpsert.run({ k: KEY_LBP, v: String(input.lbpPerUsd) })
    }
    if (input.showClassicMenu !== undefined) {
      stUpsert.run({ k: KEY_CLASSIC, v: input.showClassicMenu ? '1' : '0' })
    }
    if (input.navLayout !== undefined) {
      stUpsert.run({ k: KEY_NAV_LAYOUT, v: input.navLayout })
    }
    const g = getAppSettings(db)
    if (!g.ok) {
      throw new Error(g.error.message)
    }
    return g.data
  })
}

function readRowValue(
  st: { get: (key: string) => { value: string } | undefined },
  key: string,
  fallback: string,
): string {
  const r = st.get(key)
  return r?.value ?? fallback
}
