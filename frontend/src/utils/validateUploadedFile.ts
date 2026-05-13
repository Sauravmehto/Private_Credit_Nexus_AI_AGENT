import * as XLSX from 'xlsx'

/** Normalise a column header to lowercase alphanum for fuzzy matching */
function normKey(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Required columns and their accepted aliases.
 * Key = canonical display name shown in error messages.
 * Value = array of accepted header strings (matched via normKey).
 */
export const REQUIRED_COLUMN_ALIASES: Record<string, string[]> = {
  'Borrower / Company': [
    'borrower', 'company', 'name', 'borrower name', 'deal name',
    'company name', 'fund name', 'entity', 'issuer',
  ],
  'Instrument Type': [
    'instrument type', 'instrument', 'type', 'product',
    'debt type', 'facility type',
  ],
  'Principal ($)': [
    'principal', 'principal ($)', 'loan amount', 'commitment',
    'deal size', 'facility size', 'amount', 'loan size',
    'face value', 'investment amount',
  ],
  'Interest Rate': [
    'interest rate', 'rate', 'coupon', 'cash coupon',
    'all-in rate', 'yield', 'rate (%)', 'annual rate',
  ],
  'Tenure (Mo.)': [
    'tenure', 'tenor', 'term', 'tenure (mo.)', 'tenor (mo.)',
    'term (mo.)', 'term months', 'duration', 'loan term',
  ],
  'Orig. Fee': [
    'orig. fee', 'origination fee', 'orig fee', 'upfront fee',
    'arrangement fee', 'front end fee',
  ],
  'EOT Fee': [
    'eot fee', 'end of term fee', 'exit fee', 'eot. fee',
    'maturity fee', 'back end fee',
  ],
  'Covenant Status': [
    'covenant status', 'status', 'health', 'credit status',
    'covenant', 'compliance',
  ],
}

export interface ValidationResult {
  valid: boolean
  /** Canonical display names of required columns that were not matched */
  missing: string[]
  /** Raw headers detected in the file */
  foundColumns: string[]
}

/**
 * Validate a list of headers against the required column aliases.
 * Pass custom requiredAliases to override the default set.
 */
export function validateUploadedFile(
  headers: string[],
  requiredAliases: Record<string, string[]> = REQUIRED_COLUMN_ALIASES,
): ValidationResult {
  const normedHeaders = headers.map(normKey).filter(Boolean)
  const missing: string[] = []

  for (const [displayName, aliases] of Object.entries(requiredAliases)) {
    const normedAliases = aliases.map(normKey)
    const matched = normedAliases.some((alias) =>
      normedHeaders.some((h) =>
        h === alias ||
        (alias.length >= 4 && h.includes(alias)) ||
        (h.length >= 4 && alias.includes(h))
      )
    )
    if (!matched) missing.push(displayName)
  }

  return {
    valid: missing.length === 0,
    missing,
    foundColumns: headers.filter((h) => h.trim()),
  }
}

/**
 * Read only the header row from a File — much faster than a full parse.
 * Works for .xlsx/.xls, .csv, and .json.
 */
export async function extractHeaders(file: File): Promise<string[]> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()

  if (ext === 'json') {
    return new Promise((resolve, reject) => {
      const rd = new FileReader()
      rd.onerror = () => reject(new Error('Cannot read file.'))
      rd.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target!.result as string) as unknown
          let firstRecord: Record<string, unknown> | null = null
          if (Array.isArray(parsed) && parsed.length > 0) {
            firstRecord = parsed[0] as Record<string, unknown>
          } else if (parsed && typeof parsed === 'object') {
            const obj = parsed as Record<string, unknown>
            const arr = (obj.deals ?? obj.portfolio ?? obj.data) as unknown[] | undefined
            if (Array.isArray(arr) && arr.length > 0) firstRecord = arr[0] as Record<string, unknown>
          }
          resolve(firstRecord ? Object.keys(firstRecord) : [])
        } catch {
          reject(new Error('Invalid JSON.'))
        }
      }
      rd.readAsText(file)
    })
  }

  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      const rd = new FileReader()
      rd.onerror = () => reject(new Error('Cannot read file.'))
      rd.onload = (ev) => {
        const text = ev.target!.result as string
        const firstLine = text.split('\n')[0] ?? ''
        resolve(firstLine.split(',').map((h) => h.trim().replace(/"/g, '')))
      }
      rd.readAsText(file)
    })
  }

  // xlsx / xls — use SheetJS to read only the first sheet headers
  return new Promise((resolve, reject) => {
    const rd = new FileReader()
    rd.onerror = () => reject(new Error('Cannot read file.'))
    rd.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target!.result, { type: 'array', sheetRows: 25, cellDates: false })

        // Find the best sheet (same heuristic as fileParser.ts)
        const hdrKw = ['borrower', 'company', 'name', 'principal', 'loan', 'instrument', 'amount', 'deal']
        let best = wb.SheetNames[0]
        let bestScore = -1
        wb.SheetNames.forEach((sn) => {
          const ws = wb.Sheets[sn]
          if (!ws['!ref']) return
          const all = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
          let sc = 0
          for (let i = 0; i < Math.min(all.length, 15); i++) {
            const rs = (all[i] as unknown[]).join(' ').toLowerCase()
            hdrKw.forEach((kw) => { if (rs.includes(kw)) sc += 2 })
          }
          if (sc > bestScore) { bestScore = sc; best = sn }
        })

        const ws = wb.Sheets[best]
        const all = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

        // Find header row (first row with 3+ non-empty cells that contains a known keyword)
        for (let i = 0; i < Math.min(all.length, 20); i++) {
          const row = all[i] as unknown[]
          const nonempty = row.filter((c) => String(c || '').trim() !== '')
          if (nonempty.length < 2) continue
          const rowStr = row.join(' ').toLowerCase()
          const hasKeyword = hdrKw.some((kw) => rowStr.includes(kw))
          if (hasKeyword || nonempty.length >= 4) {
            resolve(row.map((c) => String(c || '').replace(/[\r\n]+/g, ' ').trim()).filter(Boolean))
            return
          }
        }
        resolve([])
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    rd.readAsArrayBuffer(file)
  })
}

/** Typed error thrown when schema validation fails */
export class ValidationError extends Error {
  missing: string[]
  foundColumns: string[]
  constructor(missing: string[], foundColumns: string[]) {
    super('Invalid file structure detected.')
    this.name = 'ValidationError'
    this.missing = missing
    this.foundColumns = foundColumns
  }
}
