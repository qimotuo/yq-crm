/** 本地日期 YYYY-MM-DD（避免 toISOString 的 UTC 偏差） */
export function localToday() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function localYearMonth() {
  return localToday().slice(0, 7)
}
