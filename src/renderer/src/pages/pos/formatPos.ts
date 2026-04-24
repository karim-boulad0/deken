/** Placeholder formatting until a shared money module exists (see plan 02 Phase 4). */
export function formatLbp(amount: number, lng: string): string {
  const loc = lng.startsWith('ar') ? 'ar-LB' : 'en-US'
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: 'LBP',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString(loc)} LBP`
  }
}

export function formatUsd(amount: number, lng: string): string {
  const loc = lng.startsWith('ar') ? 'ar-LB' : 'en-US'
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `$${amount.toFixed(2)}`
  }
}
