export type PeriodPreset = 'week' | 'month' | 'quarter'

/** Local calendar `YYYY-MM-DD`. */
export function toLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Start of (ISO) week — Monday 00:00 local for the same calendar day as `ref`.
 * If `ref` is Sunday, returns previous Monday.
 */
function startOfIsoWeek(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Inclusive [from, to] for preset; `to` is today (end of data), local dates.
 */
export function rangeForPreset(preset: PeriodPreset, now: Date = new Date()): {
  fromDate: string
  toDate: string
} {
  const toDate = toLocalYmd(now)

  if (preset === 'week') {
    const from = startOfIsoWeek(now)
    return { fromDate: toLocalYmd(from), toDate }
  }

  if (preset === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { fromDate: toLocalYmd(from), toDate }
  }

  const q = Math.floor(now.getMonth() / 3)
  const from = new Date(now.getFullYear(), q * 3, 1)
  return { fromDate: toLocalYmd(from), toDate }
}

export function ymdToDate(s: string): Date | null {
  const p = s.split('-').map(Number)
  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) {
    return null
  }
  return new Date(p[0]!, p[1]! - 1, p[2]!)
}
