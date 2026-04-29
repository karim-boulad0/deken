/**
 * Simple CSV parser that handles quoted cells and escaped quotes.
 */
export function parseCsv(text: string): string[][] {
  const result: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          cell += '"'
          i++
        } else {
          // End of quotes
          inQuotes = false
        }
      } else {
        cell += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(cell)
        cell = ''
      } else if (char === '\n' || char === '\r') {
        row.push(cell)
        if (row.length > 0 || cell !== '') {
          result.push(row)
        }
        row = []
        cell = ''
        if (char === '\r' && nextChar === '\n') {
          i++
        }
      } else {
        cell += char
      }
    }
  }

  // Last cell/row
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    result.push(row)
  }

  return result.map((r) => r.map((c) => c.trim()))
}
