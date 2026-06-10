const LOW_STOCK_THRESHOLD = 5
const TREND_MONTHS = 5

function orderMonth(orderNo = '') {
  const parts = orderNo.split('-')
  if (parts.length >= 2 && parts[1].length === 8) return parts[1].slice(0, 6)
  return null
}

function lastNMonths(n = TREND_MONTHS) {
  const result = []
  const d = new Date()
  let y = d.getFullYear()
  let m = d.getMonth() + 1
  for (let i = 0; i < n; i += 1) {
    result.unshift(`${y}${String(m).padStart(2, '0')}`)
    m -= 1
    if (m === 0) { m = 12; y -= 1 }
  }
  return result
}

function formatMonthLabel(ym) {
  return `${Number(ym.slice(4))}月`
}

export function buildDashboardStats({
  workOrders = [],
  customers = [],
  publicPool = [],
  financeList = [],
  stockInList = [],
  simStockInList = [],
  schedules = [],
  contracts = [],
  followUps = [],
  contacts = [],
}) {
  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = today.slice(0, 7)

  const monthlyRevenue = financeList
    .filter((f) => f.billMonth === currentMonth)
    .reduce((sum, f) => sum + (f.totalAmount || 0), 0)

  const unpaidAmount = financeList.reduce((sum, f) => sum + (f.unpaidAmount || 0), 0)
  const overdueCount = financeList.filter((f) => f.paymentStatus === '已逾期').length

  const lowStockCount = [
    ...stockInList.filter((s) => (s.stockQty ?? 0) < LOW_STOCK_THRESHOLD),
    ...simStockInList.filter((s) => (s.stockQty ?? 0) < LOW_STOCK_THRESHOLD),
  ].length

  const monthKeys = lastNMonths()
  const monthlyTrends = monthKeys.map((ym) => ({
    month: formatMonthLabel(ym),
    orders: workOrders.filter((o) => orderMonth(o.orderNo) === ym).length,
    revenue: financeList
      .filter((f) => (f.billMonth || '').replace('-', '') === ym)
      .reduce((sum, f) => sum + (f.totalAmount || 0), 0),
  }))

  return {
    totalOrders: workOrders.length,
    pendingDispatch: workOrders.filter((o) => o.status === '待派工').length,
    installing: workOrders.filter((o) => ['已派工', '安装中'].includes(o.status)).length,
    completed: workOrders.filter((o) => o.status === '已安装').length,
    totalCustomers: customers.length,
    monthlyRevenue,
    unpaidAmount,
    overdueCount,
    publicPoolCount: publicPool.filter((c) => c.status === '在公海').length,
    lowStockCount,
    todaySchedules: schedules.filter((s) => s.date === today && s.status === '待执行').length,
    contractCount: contracts.length,
    followUpCount: followUps.length,
    contactCount: contacts.length,
    monthlyTrends,
  }
}
