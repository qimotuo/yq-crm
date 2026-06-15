export function downloadCsvTemplate(tpl) {
  const bom = '\uFEFF'
  const content = bom + [tpl.headers.join(','), tpl.sample.join(',')].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = tpl.filename
  a.click()
}

export function parseCsvFile(text, tpl) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) throw new Error('文件无数据行，请使用模板填写后导入')
  const headers = lines[0].split(',').map((h) => h.trim())
  const missing = tpl.headers.filter((h) => !headers.includes(h))
  if (missing.length) throw new Error(`表头缺少列：${missing.join('、')}`)
  return lines.slice(1).map((line, idx) => {
    const cols = line.split(',').map((c) => c.trim())
    const row = {}
    tpl.headers.forEach((h, i) => {
      const key = tpl.keys[tpl.headers.indexOf(h)]
      row[key] = cols[i] || ''
    })
    const lacks = tpl.required.filter((k) => !row[k])
    if (lacks.length) {
      const labels = lacks.map((k) => tpl.headers[tpl.keys.indexOf(k)] || k)
      throw new Error(`第 ${idx + 2} 行缺少必填：${labels.join('、')}`)
    }
    return row
  })
}
