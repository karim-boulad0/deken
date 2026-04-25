/** Escape a single cell for CSV (RFC-style; works with Excel when UTF-8 BOM is used). */
export function escapeCsvCell(v: string | number | null | undefined): string {
  if (v == null) {
    return ''
  }
  const s = typeof v === 'number' && Number.isFinite(v) ? String(v) : String(v)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsvLine(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsvCell).join(',')
}

export function buildCsvContent(lines: string[]): string {
  return lines.join('\r\n')
}

/**
 * Download text with UTF-8 BOM so Excel on Windows opens Arabic/UTF-8 columns correctly.
 */
export function downloadAsCsvFile(baseName: string, lineRows: string[]): void {
  const safe = String(baseName).replace(/[^\w\-.]+/g, '_')
  const content = buildCsvContent(lineRows)
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safe || 'export'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function fileDateStamp(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
