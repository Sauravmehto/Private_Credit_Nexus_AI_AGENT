import * as XLSX from 'xlsx'
import type { Deal, DealStatus } from '../dealTypes'
import { extractHeaders, validateUploadedFile, ValidationError } from './validateUploadedFile'
export { ValidationError } from './validateUploadedFile'

const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0)

function normKey(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function col(row: Record<string, unknown>, keys: string[]): unknown {
  const c: Record<string, unknown> = {}
  for (const k of Object.keys(row)) {
    c[normKey(k)] = row[k]
  }
  for (const k of keys) {
    const nk = normKey(k)
    if (c[nk] !== undefined && c[nk] !== null && String(c[nk]).trim() !== '') return c[nk]
    for (const ck of Object.keys(c)) {
      if ((ck.includes(nk) || nk.includes(ck)) && ck.length >= 3 && nk.length >= 3 && c[ck] !== undefined && c[ck] !== null && String(c[ck]).trim() !== '') return c[ck]
    }
  }
  return ''
}

function nC(row: Record<string, unknown>, keys: string[]): number {
  const v = col(row, keys)
  if (v === '' || v === undefined) return 0
  return parseFloat(String(v).replace(/[$,%\s,]/g, '').replace(/[()]/g, '-')) || 0
}

function pC(row: Record<string, unknown>, keys: string[]): number {
  const v = nC(row, keys)
  return v > 1 ? v / 100 : v
}

export function normRow(row: Record<string, unknown>, idx: number): Deal {
  const name = String(col(row, ['Borrower','Company','Name','Borrower Name','Deal Name','Company Name','Fund Name','Entity','Issuer']) || `Deal ${idx + 1}`)
  const inst = String(col(row, ['Instrument Type','Instrument','Type','Product','Debt Type','Facility Type']) || 'term loan').toLowerCase().trim()

  let principal = nC(row, ['Principal','Principal ($)','Loan Amount','Commitment','Deal Size','Facility Size','Amount','Loan Size','Face Value','Investment Amount'])
  if (!principal) {
    for (const k of Object.keys(row)) {
      const v = parseFloat(String(row[k] || '').replace(/[$,%,\s]/g, ''))
      if (v >= 10000 && !principal) principal = v
    }
  }

  let rate = pC(row, ['Interest Rate','Rate','Coupon','Cash Coupon','All-in Rate','Yield','Rate (%)','Annual Rate'])
  if (!rate) rate = 0.12

  const tenure = parseInt(String(col(row, ['Tenure','Tenor','Term','Tenure (Mo.)','Tenor (Mo.)','Term (Mo.)','Term Months','Duration','Loan Term']) || '').replace(/[^0-9]/g, '') || '36') || 36

  let statusRaw = String(col(row, ['Covenant Status','Status','Health','Covenant','Credit Status']) || 'compliant').toLowerCase().trim()
  let status: DealStatus
  if (statusRaw.includes('breach') || statusRaw.includes('default') || statusRaw.includes('violation')) status = 'breach risk'
  else if (statusRaw.includes('monitor') || statusRaw.includes('watch') || statusRaw.includes('review')) status = 'monitoring'
  else status = 'compliant'

  const ioRaw = col(row, ['IO Period','IO Months','IO (Mo.)','IO Period (Mo.)','Interest Only','IO'])
  const io = ioRaw ? parseInt(String(ioRaw).replace(/[^0-9]/g, '')) || 0 : Math.round(tenure * 0.2) || 6

  let origFee = pC(row, ['Orig Fee','Origination Fee','Orig. Fee','Upfront Fee','Arrangement Fee','Front End Fee'])
  let eotFee = pC(row, ['EOT Fee','End of Term Fee','Exit Fee','EoT Fee','Maturity Fee','Back End Fee'])
  const pikRate = pC(row, ['PIK Rate','PIK','PIK (%)','Payment-in-Kind'])
  if (!origFee) origFee = 0.02
  if (!eotFee) eotFee = 0.025

  const origRaw = col(row, ['Origination Date','Close Date','Closing Date','Issue Date','Start Date','Funding Date','Date','Trade Date'])
  let origination: Date
  if (origRaw instanceof Date) {
    origination = new Date(origRaw)
  } else if (typeof origRaw === 'number' && origRaw > 40000) {
    origination = new Date(Math.round((origRaw - 25569) * 86400 * 1000))
  } else if (origRaw && typeof origRaw === 'string') {
    const p2 = new Date(origRaw)
    origination = isNaN(p2.getTime()) ? new Date(TODAY.getTime() - Math.round(tenure * 0.4) * 30 * 24 * 3600 * 1000) : p2
  } else {
    origination = new Date(TODAY.getTime() - Math.round(tenure * 0.4) * 30 * 24 * 3600 * 1000)
  }

  const outstanding = nC(row, ['Outstanding','Outstanding ($)','Outstanding Balance']) || principal || 0
  const dealId = String(col(row, ['Deal ID','ID','Ref']) || `D${String(idx + 1).padStart(3, '0')}`)

  return {
    id: `D${String(idx + 1).padStart(3, '0')}`,
    deal_id: dealId,
    name: name || `Deal ${idx + 1}`,
    instrument_type: inst,
    principal: principal || 0,
    outstanding,
    rate,
    io,
    amort: tenure - io,
    tenure,
    orig_fee: origFee,
    eot_fee: eotFee,
    pik_rate: pikRate || 0,
    warrant: String(col(row, ['Warrant','Warrant Coverage','Warrants']) || ''),
    status,
    sector: String(col(row, ['Sector','Industry','Vertical']) || ''),
    stage: String(col(row, ['Stage','Company Stage','Round']) || ''),
    maturity: String(col(row, ['Maturity Date','Maturity','Due Date']) || ''),
    origination,
    interest_type: String(col(row, ['Interest Type','Rate Type']) || 'Fixed'),
  }
}

export function parseCSV(txt: string): Record<string, unknown>[] {
  const lines = txt.trim().split('\n')
  if (!lines.length) return []
  const h = lines[0].split(',').map((x) => x.trim().replace(/"/g, ''))
  const out: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const v = lines[i].split(',').map((x) => x.trim().replace(/"/g, ''))
    const o: Record<string, unknown> = {}
    h.forEach((k, j) => { o[k] = v[j] || '' })
    out.push(o)
  }
  return out
}

export async function parseFile(file: File): Promise<Deal[]> {
  return new Promise((resolve, reject) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const rd = new FileReader()

    rd.onerror = () => reject(new Error('Cannot read file.'))

    rd.onload = (ev) => {
      try {
        let rows: Record<string, unknown>[] = []

        if (ext === 'json') {
          const parsed = JSON.parse(ev.target!.result as string)
          rows = Array.isArray(parsed) ? parsed : (parsed.deals || parsed.portfolio || parsed.data || [])
        } else if (ext === 'csv') {
          rows = parseCSV(ev.target!.result as string)
        } else {
          const wb = XLSX.read(ev.target!.result, { type: 'array', cellDates: true, raw: false })
          const hdrKw = ['borrower','company','name','principal','loan','instrument','amount','deal']
          let best = wb.SheetNames[0]
          let bsc = -1

          wb.SheetNames.forEach((sn) => {
            const ws = wb.Sheets[sn]
            if (!ws['!ref']) return
            const all = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
            let sc = 0
            for (let i = 0; i < Math.min(all.length, 15); i++) {
              const rs = (all[i] as unknown[]).join(' ').toLowerCase()
              hdrKw.forEach((kw) => { if (rs.includes(kw)) sc += 2 })
            }
            sc += Math.min(all.length, 50)
            if (sc > bsc) { bsc = sc; best = sn }
          })

          const ws = wb.Sheets[best]
          const all = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
          let hi = -1
          let hdr: unknown[] = []
          let bhs = -1

          for (let i = 0; i < Math.min(all.length, 20); i++) {
            const r = all[i] as unknown[]
            let sc2 = 0
            r.forEach((c) => {
              const s = String(c || '').toLowerCase().trim()
              hdrKw.forEach((kw) => { if (s === kw || s.includes(kw)) sc2++ })
            })
            const ne = r.filter((c) => String(c || '').trim() !== '').length
            if (sc2 > bhs && ne >= 2) { bhs = sc2; hi = i; hdr = r.slice() }
          }

          if (hi < 0) {
            for (let i = 0; i < all.length; i++) {
              const ne = (all[i] as unknown[]).filter((c) => String(c || '').trim() !== '').length
              if (ne >= 3) { hi = i; hdr = (all[i] as unknown[]).slice(); break }
            }
          }

          if (hi < 0) { reject(new Error('Cannot find header row.')); return }

          const headers = (hdr as unknown[]).map((h2) => String(h2 || '').replace(/[\r\n]+/g, ' ').trim())

          for (let k = hi + 1; k < all.length; k++) {
            const row = all[k] as unknown[]
            const ne = row.filter((c) => String(c || '').trim() !== '').length
            if (ne < 2) continue
            const first = String(row[0] || row[1] || '').trim().toUpperCase()
            if (first.startsWith('TOTAL') || first.startsWith('SUBTOTAL') || first.startsWith('GRAND')) continue
            const obj: Record<string, unknown> = {}
            headers.forEach((h2, m2) => { if (h2) obj[h2] = row[m2] !== undefined ? row[m2] : '' })
            rows.push(obj)
          }
        }

        if (!rows.length) { reject(new Error('No data rows found in file.')); return }
        resolve(rows.map((r, i) => normRow(r, i)))
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    if (ext === 'xlsx' || ext === 'xls') rd.readAsArrayBuffer(file)
    else rd.readAsText(file)
  })
}

/**
 * Validates the file schema first, then full-parses it.
 * Throws ValidationError if required columns are missing.
 * Throws Error for unsupported extensions or parse failures.
 */
export async function validateAndParse(file: File): Promise<Deal[]> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!['xlsx', 'xls', 'csv', 'json'].includes(ext)) {
    throw new Error(`Unsupported file type ".${ext}". Please upload .xlsx, .csv, or .json.`)
  }
  const headers = await extractHeaders(file)
  const result = validateUploadedFile(headers)
  if (!result.valid) {
    throw new ValidationError(result.missing, result.foundColumns)
  }
  return parseFile(file)
}
