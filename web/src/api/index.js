import { registerMock, request } from './request'
import { getCurrentUser } from '../rbac/utils'
import { customers, financeList, stockInList, stockOutList, simStockInList, publicPoolCustomers, followUps, integratedList, schedules, contacts, contracts, poolConfig, notifications, delay } from '../mock/data'

let customerStore = [...customers]
let financeStore = [...financeList]
let publicPoolStore = [...publicPoolCustomers]
let followUpStore = [...followUps]
let scheduleStore = [...schedules]
let contactStore = [...contacts]
let contractStore = [...contracts]
let stockOutStore = [...stockOutList]
let poolConfigStore = { ...poolConfig }
let notificationStore = [...notifications]
registerMock('GET', '/customers', async (body, params = {}) => {
  await delay()
  let list = [...customerStore]
  if (params.keyword) {
    const kw = params.keyword
    list = list.filter((c) => c.customerName.includes(kw) || c.storeName.includes(kw) || c.phone.includes(kw))
  }
  if (params.salesName) list = list.filter((c) => c.salesName === params.salesName)
  return { list, total: list.length }
})

registerMock('GET', '/customers/detail', async (body, params) => {
  await delay(100)
  return customerStore.find((c) => c.id === Number(params.id))
})

registerMock('PUT', '/customers/update', async (body) => {
  await delay()
  customerStore = customerStore.map((c) => (c.id === body.id ? { ...c, ...body } : c))
  return customerStore.find((c) => c.id === body.id)
})

registerMock('GET', '/public-pool', async (body, params = {}) => {
  await delay()
  let list = publicPoolStore.filter((c) => c.status === '在公海')
  if (params.keyword) {
    const kw = params.keyword
    list = list.filter((c) => c.customerName.includes(kw) || c.storeName.includes(kw))
  }
  return { list, total: list.length }
})

registerMock('POST', '/public-pool/claim', async (body) => {
  await delay()
  const user = getCurrentUser()
  const item = publicPoolStore.find((c) => c.id === body.id)
  if (!item) throw new Error('客户不存在')
  publicPoolStore = publicPoolStore.map((c) => (c.id === body.id ? { ...c, status: '已领取', salesName: user.name } : c))
  const newCustomer = { ...item, id: customerStore.length + 1, salesName: user.name, contactStatus: '正常', orderNo: '', installDate: '' }
  customerStore.unshift(newCustomer)
  return newCustomer
})

registerMock('POST', '/public-pool/return', async (body) => {
  await delay()
  customerStore = customerStore.filter((c) => c.id !== body.id)
  publicPoolStore.unshift({ ...body, id: publicPoolStore.length + 1, status: '在公海', salesName: '' })
  return true
})

registerMock('GET', '/follow-ups', async (body, params = {}) => {
  await delay()
  let list = [...followUpStore]
  if (params.customerId) list = list.filter((f) => f.customerId === Number(params.customerId))
  return { list, total: list.length }
})

registerMock('POST', '/follow-ups', async (body) => {
  await delay()
  const item = { id: followUpStore.length + 1, createTime: new Date().toISOString().slice(0, 16).replace('T', ' '), ...body }
  followUpStore.unshift(item)
  return item
})

registerMock('GET', '/finance', async (body, params = {}) => {
  await delay()
  let list = [...financeStore]
  if (params.paymentStatus) list = list.filter((f) => f.paymentStatus === params.paymentStatus)
  return { list, total: list.length }
})

registerMock('PUT', '/finance/payment', async (body) => {
  await delay()
  financeStore = financeStore.map((f) => {
    if (f.id !== body.id) return f
    const paidAmount = body.paidAmount
    const unpaidAmount = f.totalAmount - paidAmount
    let paymentStatus = '未回款'
    let paymentProgress = 0
    if (paidAmount >= f.totalAmount) {
      paymentStatus = '已回款'
      paymentProgress = 100
    } else if (paidAmount > 0) {
      paymentStatus = '部分回款'
      paymentProgress = Math.round((paidAmount / f.totalAmount) * 100)
    } else if (new Date(f.paymentPlanDate) < new Date()) {
      paymentStatus = '已逾期'
    }
    return { ...f, paidAmount, unpaidAmount, paymentStatus, paymentProgress, ...body }
  })
  return financeStore.find((f) => f.id === body.id)
})

registerMock('GET', '/stock/in', async () => {
  await delay()
  return { list: stockInList, total: stockInList.length }
})

registerMock('GET', '/stock/sim-in', async () => {
  await delay()
  return { list: simStockInList, total: simStockInList.length }
})

registerMock('GET', '/stock/out', async () => {
  await delay()
  return { list: stockOutStore, total: stockOutStore.length }
})

registerMock('POST', '/stock/out', async (body) => {
  await delay()
  const id = stockOutStore.length + 1
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const item = {
    id,
    outNo: `CK${date}${String(id).padStart(3, '0')}`,
    outDate: new Date().toISOString().slice(0, 10),
    ...body,
  }
  stockOutStore.unshift(item)
  return item
})

registerMock('GET', '/pool/config', async () => {
  await delay(100)
  return poolConfigStore
})

registerMock('PUT', '/pool/config', async (body) => {
  await delay()
  poolConfigStore = { ...poolConfigStore, ...body }
  return poolConfigStore
})

registerMock('POST', '/public-pool/import', async () => {
  await delay(800)
  const newItems = [
    { id: publicPoolStore.length + 200, storeName: '导入-新茶饮', customerName: '新茶饮连锁', contact: '赵总', phone: '13500135099', address: '导入数据', source: '导入', status: '在公海' },
  ]
  publicPoolStore = [...newItems, ...publicPoolStore]
  return { count: 1, list: newItems }
})

registerMock('GET', '/notifications', async () => {
  await delay(100)
  return { list: notificationStore, unread: notificationStore.filter((n) => !n.read).length }
})

registerMock('PUT', '/notifications/read', async (body) => {
  await delay(50)
  if (body.id) {
    notificationStore = notificationStore.map((n) => (n.id === body.id ? { ...n, read: true } : n))
  } else {
    notificationStore = notificationStore.map((n) => ({ ...n, read: true }))
  }
  return { unread: notificationStore.filter((n) => !n.read).length }
})

registerMock('GET', '/integrated', async (body, params = {}) => {
  await delay()
  let list = [...integratedList]
  if (params.keyword) {
    const kw = params.keyword
    list = list.filter((i) => i.customerName.includes(kw) || i.orderNo.includes(kw) || i.storeName.includes(kw))
  }
  return { list, total: list.length }
})

registerMock('GET', '/trace', async (body, params = {}) => {
  await delay(400)
  const { type, value } = params
  if (!value) return null
  const chains = {
    mac: { key: 'AA:BB:CC:DD:EE:01', steps: ['设备 MAC: AA:BB:CC:DD:EE:01', '出库单: CK20261027001', '工单: GD-20261025-088', '客户: 智慧社区A区物业', '合同: SH20261105001', '回款: 已回款 ¥12,000'] },
    iccid: { key: '89860123456789012345', steps: ['SIM: 89860123456789012345', '绑定设备 MAC: AA:BB:CC:DD:EE:01', '工单: GD-20261025-088', '客户: 智慧社区A区物业'] },
    orderNo: { key: 'GD-20261025-088', steps: ['工单: GD-20261025-088', '派工: 赵云 / 2026-10-27', '出库: 鲲鹏618 / CK20261027001', '安装登记: 已安装', '财务: 应收 ¥12,000 / 已回款'] },
    contractNo: { key: 'SH20261105001', steps: ['合同: SH20261105001', '工单: GD-20261025-088', '客户: 智慧社区A区物业', '回款记录: 2 笔 / 合计 ¥12,000'] },
  }
  const chain = chains[type]
  if (chain && value.includes(chain.key.slice(0, 6))) return chain
  if (type === 'orderNo' && value.includes('GD-')) return chains.orderNo
  return { key: value, steps: [`未找到 "${value}" 的完整链路`, '请尝试: AA:BB:CC / 898601 / GD-20261025'] }
})

registerMock('POST', '/finance/send-bill', async (body) => {
  await delay(500)
  return { success: true, message: `对账单已发送至 ${body.email || '客户邮箱'}` }
})

registerMock('GET', '/schedules', async (body, params = {}) => {
  await delay()
  let list = [...scheduleStore]
  const user = getCurrentUser()
  if (user.role === 'sales') list = list.filter((s) => s.salesName === user.name)
  if (params.date) list = list.filter((s) => s.date === params.date)
  return { list, total: list.length }
})

registerMock('POST', '/schedules', async (body) => {
  await delay()
  const user = getCurrentUser()
  const item = { id: scheduleStore.length + 1, salesName: user.name, status: '待执行', ...body }
  scheduleStore.unshift(item)
  return item
})

registerMock('GET', '/contacts', async (body, params = {}) => {
  await delay()
  let list = [...contactStore]
  if (params.keyword) {
    const kw = params.keyword
    list = list.filter((c) => c.name.includes(kw) || c.customerName.includes(kw) || c.phone.includes(kw))
  }
  return { list, total: list.length }
})

registerMock('POST', '/contacts', async (body) => {
  await delay()
  const item = { id: contactStore.length + 1, ...body }
  contactStore.unshift(item)
  return item
})

registerMock('GET', '/contracts', async (body, params = {}) => {
  await delay()
  let list = [...contractStore]
  if (params.status) list = list.filter((c) => c.status === params.status)
  if (params.keyword) {
    const kw = params.keyword
    list = list.filter((c) => c.contractNo.includes(kw) || c.customerName.includes(kw) || c.orderNo.includes(kw))
  }
  return { list, total: list.length }
})

registerMock('POST', '/contracts/generate', async (body) => {
  await delay()
  contractStore = contractStore.map((c) =>
    c.orderNo === body.orderNo ? { ...c, status: '正常', contractNo: c.contractNo.replace('待', 'SH') } : c,
  )
  return contractStore.find((c) => c.orderNo === body.orderNo)
})

export function login(username, password) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

export function getCustomers(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/customers?${qs}`)
}

export function getCustomer(id) {
  return request(`/customers/detail?id=${id}`)
}

export function updateCustomer(id, data) {
  return request('/customers/update', { method: 'PUT', body: JSON.stringify({ id, ...data }) })
}

export function getPublicPool(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/public-pool?${qs}`)
}

export function claimCustomer(id) {
  return request('/public-pool/claim', { method: 'POST', body: JSON.stringify({ id }) })
}

export function returnCustomer(data) {
  return request('/public-pool/return', { method: 'POST', body: JSON.stringify(data) })
}

export function getFollowUps(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/follow-ups?${qs}`)
}

export function createFollowUp(data) {
  return request('/follow-ups', { method: 'POST', body: JSON.stringify(data) })
}

export function getFinanceList(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/finance?${qs}`)
}

export function recordPayment(data) {
  return request('/finance/payment', { method: 'PUT', body: JSON.stringify(data) })
}

export function getStockIn() {
  return request('/stock/in')
}

export function getSimStockIn() {
  return request('/stock/sim-in')
}

export function getStockOut() {
  return request('/stock/out')
}

export function getIntegratedList(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/integrated?${qs}`)
}

export function traceQuery(type, value) {
  const qs = new URLSearchParams({ type, value }).toString()
  return request(`/trace?${qs}`)
}

export function getSystemUsers() {
  return request('/system/users')
}

export function createSystemUser(data) {
  return request('/system/users', { method: 'POST', body: JSON.stringify(data) })
}

export function updateSystemUser(data) {
  return request('/system/users', { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteSystemUser(id) {
  return request(`/system/users?id=${id}`, { method: 'DELETE' })
}

export function resetUserPassword(id) {
  return request('/system/users/reset-password', { method: 'POST', body: JSON.stringify({ id }) })
}

export function toggleUserEnabled(id, enabled) {
  return request('/system/users/toggle', { method: 'PUT', body: JSON.stringify({ id, enabled }) })
}

export function sendBill(data) {
  return request('/finance/send-bill', { method: 'POST', body: JSON.stringify(data) })
}

export function getDashboardStats() {
  return request('/dashboard/stats')
}

export function getSchedules(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/schedules?${qs}`)
}

export function createSchedule(data) {
  return request('/schedules', { method: 'POST', body: JSON.stringify(data) })
}

export function getContacts(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/contacts?${qs}`)
}

export function createContact(data) {
  return request('/contacts', { method: 'POST', body: JSON.stringify(data) })
}

export { getRoles, getRoleDetail, updateRole, createRole, getPermissionsByRole } from './rbac'

export function getContracts(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/contracts?${qs}`)
}

export function generateContract(orderNo) {
  return request('/contracts/generate', { method: 'POST', body: JSON.stringify({ orderNo }) })
}

export function getPoolConfig() {
  return request('/pool/config')
}

export function updatePoolConfig(data) {
  return request('/pool/config', { method: 'PUT', body: JSON.stringify(data) })
}

export function importPublicPool() {
  return request('/public-pool/import', { method: 'POST', body: '{}' })
}

export function createStockOut(data) {
  return request('/stock/out', { method: 'POST', body: JSON.stringify(data) })
}

export function getNotifications() {
  return request('/notifications')
}

export function markNotificationRead(id) {
  return request('/notifications/read', { method: 'PUT', body: JSON.stringify(id ? { id } : {}) })
}
