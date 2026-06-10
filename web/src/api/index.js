import { registerMock, request } from './request'
import { getCurrentUser } from '../rbac/utils'
import { calcPaymentStatus } from '../utils/finance'
import { buildDashboardStats } from '../utils/dashboardStats'
import { getWorkOrderStore } from './workOrder'
import { getScheduleStore } from './notify'
import { DEFAULT_ROLES } from '../rbac/config'
import { customers, financeList, stockInList, stockOutList, simStockInList, publicPoolCustomers, followUps, integratedList, contacts, contracts, poolConfig, returnLogs, systemUsers, delay } from '../mock/data'

let customerStore = [...customers]
let financeStore = [...financeList]
let integratedStore = [...integratedList]

function syncFinanceRelated(financeItem) {
  integratedStore = integratedStore.map((i) =>
    i.orderNo === financeItem.orderNo
      ? {
        ...i,
        paidAmount: financeItem.paidAmount,
        unpaidAmount: financeItem.unpaidAmount,
        paymentStatus: financeItem.paymentStatus,
        paymentProgress: financeItem.paymentProgress,
        contractStatus: financeItem.contractStatus,
        invoiceStatus: financeItem.invoiceStatus,
      }
      : i,
  )
  customerStore = customerStore.map((c) =>
    c.financeId === financeItem.id
      ? { ...c, lastPaymentTime: financeItem.lastPaymentTime || c.lastPaymentTime, lastPaymentAmount: financeItem.paidAmount }
      : c,
  )
}
let publicPoolStore = [...publicPoolCustomers]
let followUpStore = [...followUps]
let contactStore = [...contacts]
let contractStore = [...contracts]
let stockOutStore = [...stockOutList]
let poolConfigStore = { ...poolConfig }
let returnLogStore = [...returnLogs]

const PHONE_RE = /^1\d{10}$/
function validatePhone(phone) {
  if (phone && !PHONE_RE.test(phone)) throw new Error('手机号格式不正确，需为11位数字')
}
function nowStr() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}
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

registerMock('POST', '/customers', async (body) => {
  await delay()
  const item = { id: customerStore.length + 1, contactStatus: '正常', orderNo: '', installDate: '', financeId: null, lastPaymentTime: '', lastPaymentAmount: 0, ...body }
  customerStore.unshift(item)
  return item
})

registerMock('DELETE', '/customers', async (body, params) => {
  await delay()
  const id = Number(params.id)
  customerStore = customerStore.filter((c) => c.id !== id)
  return true
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

registerMock('POST', '/public-pool', async (body) => {
  await delay()
  validatePhone(body.phone)
  const item = { id: publicPoolStore.length + 300, source: '手动', status: '在公海', ...body }
  publicPoolStore.unshift(item)
  return item
})

registerMock('POST', '/public-pool/claim', async (body) => {
  await delay()
  const user = getCurrentUser()
  const item = publicPoolStore.find((c) => c.id === body.id)
  if (!item) throw new Error('客户不存在')
  publicPoolStore = publicPoolStore.map((c) => (c.id === body.id ? { ...c, status: '已领取', salesName: user.name } : c))
  const newCustomer = {
    ...item, id: customerStore.length + 1, salesName: user.name, contactStatus: '待跟进',
    orderNo: '', installDate: '', claimTime: nowStr(), lastFollowTime: '', wechatId: '',
  }
  customerStore.unshift(newCustomer)
  return newCustomer
})

registerMock('POST', '/public-pool/return', async (body) => {
  await delay()
  const user = getCurrentUser()
  const item = customerStore.find((c) => c.id === body.id)
  customerStore = customerStore.filter((c) => c.id !== body.id)
  publicPoolStore.unshift({ ...item, id: publicPoolStore.length + 1, status: '在公海', salesName: '', source: '退回' })
  returnLogStore.unshift({
    id: returnLogStore.length + 1,
    customerName: item?.customerName || body.customerName,
    storeName: item?.storeName || body.storeName,
    salesName: user.name,
    reason: body.reason || '手动退回',
    returnTime: nowStr(),
  })
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
  const ts = nowStr()
  const item = { id: followUpStore.length + 1, createTime: ts, ...body }
  followUpStore.unshift(item)
  if (body.customerId) {
    customerStore = customerStore.map((c) =>
      c.id === body.customerId
        ? { ...c, lastFollowTime: ts, contactStatus: c.contactStatus === '待跟进' ? '正常' : c.contactStatus }
        : c,
    )
  }
  return item
})

registerMock('GET', '/finance', async (body, params = {}) => {
  await delay()
  let list = [...financeStore]
  if (params.paymentStatus) list = list.filter((f) => f.paymentStatus === params.paymentStatus)
  if (params.orderNo) list = list.filter((f) => f.orderNo === params.orderNo)
  if (params.id) list = list.filter((f) => f.id === Number(params.id))
  return { list, total: list.length }
})

registerMock('GET', '/finance/payments', async (body, params) => {
  await delay(100)
  const item = financeStore.find((f) => f.id === Number(params.id))
  return { list: item?.paymentRecords || [], total: item?.paymentRecords?.length || 0 }
})

registerMock('PUT', '/finance/payment', async (body) => {
  await delay()
  let updated = null
  financeStore = financeStore.map((f) => {
    if (f.id !== body.id) return f
    const paidAmount = body.paidAmount
    const records = [...(f.paymentRecords || [])]
    if (body.voucher || body.verified) {
      records.push({
        id: records.length + 1,
        amount: paidAmount - (f.paidAmount || 0) > 0 ? paidAmount - f.paidAmount : paidAmount,
        time: new Date().toISOString().slice(0, 10),
        voucher: body.voucher || '',
        verified: !!body.verified,
      })
    }
    const lastPaymentTime = paidAmount > 0 ? new Date().toISOString().slice(0, 10) : f.lastPaymentTime
    updated = {
      ...f,
      paidAmount,
      unpaidAmount: f.totalAmount - paidAmount,
      paymentStatus: calcPaymentStatus(f.totalAmount, paidAmount, f.paymentPlanDate).paymentStatus,
      paymentProgress: calcPaymentStatus(f.totalAmount, paidAmount, f.paymentPlanDate).paymentProgress,
      paymentRecords: records,
      lastPaymentTime,
    }
    return updated
  })
  if (updated) syncFinanceRelated(updated)
  return updated
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

registerMock('GET', '/integrated', async (body, params = {}) => {
  await delay()
  let list = [...integratedStore]
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
    customer: { key: '智慧社区A区物业', steps: ['客户: 智慧社区A区物业 / 红渡小香', '工单: GD-20261025-088', '设备: 鲲鹏618 / AA:BB:CC:DD:EE:01', '合同: SH20261105001', '财务: 已回款 ¥12,000'] },
  }
  const chain = chains[type]
  if (chain && value.includes(chain.key.slice(0, 4))) return chain
  if (type === 'orderNo' && value.includes('GD-')) return chains.orderNo
  if (type === 'customer') {
    const c = customerStore.find((x) => x.customerName.includes(value) || x.storeName.includes(value))
    if (c) {
      const fin = financeStore.find((f) => f.orderNo === c.orderNo)
      const con = contractStore.find((x) => x.orderNo === c.orderNo)
      return {
        key: c.customerName,
        steps: [
          `客户: ${c.customerName}（${c.storeName}）`,
          `工单: ${c.orderNo || '暂无'}`,
          `设备: ${c.deviceSupplier || '-'} ${c.deviceModel || ''} / ${c.mac || '-'}`,
          `合同: ${con?.contractNo || '-'}`,
          `财务: ${fin ? `${fin.paymentStatus} / 已收 ¥${fin.paidAmount}` : '暂无账单'}`,
        ],
      }
    }
  }
  return { key: value, steps: [`未找到 "${value}" 的完整链路`, '请尝试: 智慧社区 / AA:BB:CC / GD-20261025'] }
})

registerMock('POST', '/finance/send-bill', async (body) => {
  await delay(500)
  return { success: true, message: `对账单已发送至 ${body.email || '客户邮箱'}` }
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
  validatePhone(body.phone)
  const item = { id: contactStore.length + 1, isPrimary: false, ...body }
  if (item.isPrimary) {
    contactStore = contactStore.map((c) => (c.customerName === item.customerName ? { ...c, isPrimary: false } : c))
  }
  contactStore.unshift(item)
  return item
})

registerMock('PUT', '/contacts', async (body) => {
  await delay()
  validatePhone(body.phone)
  if (body.isPrimary) {
    contactStore = contactStore.map((c) =>
      c.customerName === body.customerName && c.id !== body.id ? { ...c, isPrimary: false } : c,
    )
  }
  contactStore = contactStore.map((c) => (c.id === body.id ? { ...c, ...body } : c))
  return contactStore.find((c) => c.id === body.id)
})

registerMock('POST', '/contacts/import', async () => {
  await delay(600)
  const item = { id: contactStore.length + 1, customerName: '导入客户示例', storeName: '示例门店', name: '导入联系人', phone: '13800138888', title: '经理', isPrimary: true }
  contactStore.unshift(item)
  return { count: 1 }
})

registerMock('GET', '/pool/return-logs', async () => {
  await delay(100)
  return { list: returnLogStore, total: returnLogStore.length }
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

registerMock('POST', '/auth/login', async (body) => {
  await delay()
  const { username, password } = body
  if (password !== '123456') throw new Error('用户名或密码错误')
  const user = systemUsers.find((u) => u.username === username)
  if (!user) throw new Error('用户名或密码错误')
  if (!user.enabled) throw new Error('账号已禁用，请联系管理员')
  const role = DEFAULT_ROLES.find((r) => r.code === user.role)
  const permissions = role
    ? { menuKeys: role.menuKeys, operations: role.operations, dataScope: role.dataScope }
    : { menuKeys: [], operations: [], dataScope: 'SELF' }
  return {
    token: `mock-token-${user.id}-${Date.now()}`,
    user: { id: user.id, username: user.username, name: user.name, role: user.role, enabled: user.enabled },
    permissions,
  }
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

export function getPaymentRecords(financeId) {
  return request(`/finance/payments?id=${financeId}`)
}

export function createCustomer(data) {
  return request('/customers', { method: 'POST', body: JSON.stringify(data) })
}

export function deleteCustomer(id) {
  return request(`/customers?id=${id}`, { method: 'DELETE' })
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

registerMock('GET', '/dashboard/stats', async () => {
  await delay()
  return buildDashboardStats({
    workOrders: getWorkOrderStore(),
    customers: customerStore,
    publicPool: publicPoolStore,
    financeList: financeStore,
    stockInList,
    simStockInList,
    schedules: getScheduleStore(),
    contracts: contractStore,
    followUps: followUpStore,
    contacts: contactStore,
  })
})

export function getDashboardStats() {
  return request('/dashboard/stats')
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

export function createPublicPoolCustomer(data) {
  return request('/public-pool', { method: 'POST', body: JSON.stringify(data) })
}

export function updateContact(data) {
  return request('/contacts', { method: 'PUT', body: JSON.stringify(data) })
}

export function importContacts() {
  return request('/contacts/import', { method: 'POST', body: '{}' })
}

export function getReturnLogs() {
  return request('/pool/return-logs')
}

export function createStockOut(data) {
  return request('/stock/out', { method: 'POST', body: JSON.stringify(data) })
}
