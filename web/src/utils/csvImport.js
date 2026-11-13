import * as XLSX from 'xlsx'

export const IMPORT_ACCEPT = '.csv,.xlsx,.xls'

export function downloadCsvTemplate(tpl) {
  const bom = '\uFEFF'
  const content = bom + [tpl.headers.join(','), tpl.sample.join(',')].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = tpl.filename
  a.click()
}

export function downloadXlsxTemplate(tpl) {
  const ws = XLSX.utils.aoa_to_sheet([tpl.headers, tpl.sample])
  const textCols = new Set((tpl.textKeys || []).map((k) => tpl.keys.indexOf(k)).filter((i) => i >= 0))
  const range = XLSX.utils.decode_range(ws['!ref'])
  range.e.r = Math.max(range.e.r, 500)
  textCols.forEach((c) => {
    for (let r = 1; r <= range.e.r; r++) {
      const ref = XLSX.utils.encode_cell({ r, c })
      ws[ref] = { ...(ws[ref] || { v: '' }), t: 's', z: '@' }
    }
  })
  ws['!ref'] = XLSX.utils.encode_range(range)
  ws['!cols'] = tpl.headers.map((h, i) => ({ wch: textCols.has(i) ? 22 : Math.max(10, h.length * 2 + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, tpl.filename)
}

function normalizeCell(value) {
  if (value == null) return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Math.abs(value - Math.round(value)) < 1e-6) return String(Math.round(value))
    return String(value)
  }
  let s = String(value).replace(/^\uFEFF/, '').replace(/\u00A0/g, ' ').trim()
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1).replace(/""/g, '"').trim()
  }
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n)) s = String(Math.round(n))
  }
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '')
  return s
}

function normHeader(value) {
  return normalizeCell(value).replace(/[\s\u3000]+/g, '')
}

function rowsFromMatrix(matrix, tpl) {
  const cleaned = (matrix || []).map((row) => (Array.isArray(row) ? row : [row]).map((cell) => normalizeCell(cell)))
  const optional = new Set((tpl.optional || []).map(normHeader))
  const expected = tpl.headers.map(normHeader)
  const requiredHeaders = expected.filter((h) => !optional.has(h))

  let headerIdx = -1
  let headers = []
  const scan = Math.min(cleaned.length, 15)
  for (let i = 0; i < scan; i++) {
    if (!cleaned[i].some(Boolean)) continue
    const hs = cleaned[i].map(normHeader)
    const missing = requiredHeaders.filter((h) => !hs.includes(h))
    if (!missing.length) {
      headerIdx = i
      headers = hs
      break
    }
  }
  if (headerIdx < 0) {
    const shown = cleaned[0] ? cleaned[0].map(normHeader) : []
    const missing = tpl.headers.filter((h, i) => !optional.has(expected[i]) && !shown.includes(expected[i]))
    throw new Error(`表头缺少列：${missing.join('、')}`)
  }

  const out = []
  for (let i = headerIdx + 1; i < cleaned.length; i++) {
    const cols = cleaned[i]
    if (!cols.some(Boolean)) continue
    const row = {}
    tpl.headers.forEach((h, hi) => {
      const key = tpl.keys[hi]
      const names = [h, ...(tpl.aliases?.[key] || [])].map(normHeader)
      const colIdx = headers.findIndex((name) => names.includes(name))
      row[key] = colIdx >= 0 ? (cols[colIdx] || '') : ''
    })
    Object.entries(tpl.aliases || {}).forEach(([key, names]) => {
      if (row[key]) return
      const wanted = names.map(normHeader)
      const colIdx = headers.findIndex((name) => wanted.includes(name))
      if (colIdx >= 0) row[key] = cols[colIdx] || ''
    })
    const lacks = (tpl.required || []).filter((k) => !row[k])
    const followOnly = tpl.allowFollowRow && row.followContent && !row.storeName
    if (lacks.length && !followOnly) {
      const hintKeys = new Set(tpl.hintKeys || [])
      const filled = tpl.keys.filter((k) => row[k])
      if (hintKeys.size && filled.length && filled.every((k) => hintKeys.has(k))) continue
      const labels = lacks.map((k) => tpl.headers[tpl.keys.indexOf(k)] || k)
      throw new Error(`第 ${i + 1} 行缺少必填：${labels.join('、')}`)
    }
    out.push(row)
  }
  if (!out.length) throw new Error('文件无数据行，请使用模板填写后导入')
  return out
}

function detectDelimiter(line) {
  const counts = { ',': 0, '\t': 0, ';': 0 }
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') i += 1
      else inQuotes = !inQuotes
    } else if (!inQuotes && counts[ch] !== undefined) {
      counts[ch] += 1
    }
  }
  let best = ','
  let bestCount = 0
  for (const [delimiter, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }
  return best
}

function parseCsvMatrix(text) {
  const src = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const firstLine = src.split('\n').find((line) => line.trim()) || ''
  const delimiter = detectDelimiter(firstLine)
  const rows = []
  let row = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(cur)
      cur = ''
    } else if (ch === '\n') {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.length || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

function decodeText(buf, encoding) {
  try {
    return new TextDecoder(encoding).decode(buf)
  } catch {
    return ''
  }
}

function isExcel(buf, filename) {
  const name = String(filename || '').toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return true
  const u8 = new Uint8Array(buf.slice(0, 4))
  if (u8[0] === 0x50 && u8[1] === 0x4b) return true
  if (u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) return true
  return false
}

function parseWorkbook(buf, tpl) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })
  const name = wb.SheetNames[0]
  if (!name) throw new Error('Excel 中没有可读取的工作表')
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' })
  return rowsFromMatrix(matrix, tpl)
}

export function parseCsvFile(text, tpl) {
  return rowsFromMatrix(parseCsvMatrix(text), tpl)
}

export function parseImportBuffer(buf, filename, tpl) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  if (isExcel(bytes, filename)) return parseWorkbook(bytes, tpl)
  const utf8 = decodeText(bytes, 'utf-8').replace(/^\uFEFF/, '')
  try {
    return rowsFromMatrix(parseCsvMatrix(utf8), tpl)
  } catch (error) {
    if (!String(error?.message || '').startsWith('表头缺少列')) throw error
    const gbk = decodeText(bytes, 'gbk')
    if (!gbk || gbk === utf8) throw error
    return rowsFromMatrix(parseCsvMatrix(gbk), tpl)
  }
}

export async function parseImportFile(file, tpl) {
  const buf = await file.arrayBuffer()
  return parseImportBuffer(buf, file.name || '', tpl)
}
