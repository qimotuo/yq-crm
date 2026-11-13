import { BASE_URL, request } from './request'

export { login, getMe, updateProfile, changePassword } from './auth'
export { getRoles, getRoleDetail, updateRole, createRole, getPermissionsByRole } from './rbac'

export function getCustomers(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/customers?${qs}`)
}

export function getCustomer(id) {
  return request(`/customers/detail?id=${id}`)
}

export function getSalesOptions() {
  return request('/customers/sales-options')
}

export function getOwnerReview() {
  return request('/customers/owner-review')
}

export function transferCustomer(data) {
  return request('/customers/transfer', { method: 'POST', body: JSON.stringify(data) })
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

export function createFinance(data) {
  return request('/finance', { method: 'POST', body: JSON.stringify(data) })
}

export function updateFinance(data) {
  return request('/finance/update', { method: 'PUT', body: JSON.stringify(data) })
}

export function importFinance(rows) {
  return request('/finance/import', { method: 'POST', body: JSON.stringify({ rows }) })
}

export function getAccountLedger(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/account-ledger?${qs}`)
}

export function createAccountLedger(data) {
  return request('/account-ledger', { method: 'POST', body: JSON.stringify(data) })
}

export function deleteAccountLedger(id) {
  return request(`/account-ledger?id=${id}`, { method: 'DELETE' })
}

export function getAdminLedger(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/admin-ledger?${qs}`)
}

export function createAdminLedger(data) {
  return request('/admin-ledger', { method: 'POST', body: JSON.stringify(data) })
}

export function deleteAdminLedger(id) {
  return request(`/admin-ledger?id=${id}`, { method: 'DELETE' })
}

export function importAdminLedger(rows) {
  return request('/admin-ledger/import', { method: 'POST', body: JSON.stringify({ rows }) })
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

export function importCustomers(rows) {
  return request('/customers/import', { method: 'POST', body: JSON.stringify({ rows }) })
}

export function importMyCustomers(rows, salesName) {
  return request('/customers/my-import', { method: 'POST', body: JSON.stringify({ rows, salesName }) })
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

export function getStockConfig() {
  return request('/stock/config')
}

export function updateStockConfig(data) {
  return request('/stock/config', { method: 'PUT', body: JSON.stringify(data) })
}

export function getChangeLogs(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/change-logs?${qs}`)
}

export function updateIntegrated(data) {
  return request('/integrated/update', { method: 'PUT', body: JSON.stringify(data) })
}

export function getIntegratedList(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/integrated?${qs}`)
}

export function importIntegrated(rows) {
  return request('/integrated/import', { method: 'POST', body: JSON.stringify({ rows }) })
}

export async function importIntegratedStream(rows, handlers = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}/integrated/import/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rows }),
  })
  if (res.status === 401) throw new Error('登录已过期，请重新登录')
  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.message || '导入失败')
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let acc = ''
  let sawDone = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    acc += dec.decode(value, { stream: true })
    const blocks = acc.split('\n\n')
    acc = blocks.pop() || ''
    for (const block of blocks) {
      const line = block.trim()
      if (!line.startsWith('data: ')) continue
      const data = JSON.parse(line.slice(6))
      if (data.type === 'start' || data.type === 'progress') handlers.onProgress?.(data)
      else if (data.type === 'row_error') handlers.onRowError?.(data)
      else if (data.type === 'done') {
        sawDone = true
        handlers.onDone?.(data)
      } else if (data.type === 'fatal') {
        throw new Error(data.message || '导入失败')
      }
    }
  }
  if (!sawDone) throw new Error('导入中断')
}

export function traceQuery(type, value) {
  const qs = new URLSearchParams({ type, value }).toString()
  return request(`/trace?${qs}`)
}

export function getFinanceByOrder(orderNo) {
  return request(`/finance?orderNo=${encodeURIComponent(orderNo)}`)
}

export function getContractByOrder(orderNo) {
  return request(`/contracts?orderNo=${encodeURIComponent(orderNo)}`)
}

export function getSystemUsers(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v) })
  const q = qs.toString()
  return request(`/system/users${q ? `?${q}` : ''}`)
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

export function importSystemUsers(rows) {
  return request('/system/users/import', { method: 'POST', body: JSON.stringify({ rows }) })
}

export function sendBill(data) {
  return request('/finance/send-bill', { method: 'POST', body: JSON.stringify(data) })
}

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

export function getContracts(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/contracts?${qs}`)
}

export function createContract(data) {
  return request('/contracts', { method: 'POST', body: JSON.stringify(data) })
}

export function updateContract(data) {
  return request('/contracts/update', { method: 'PUT', body: JSON.stringify(data) })
}

export function importContracts(rows) {
  return request('/contracts/import', { method: 'POST', body: JSON.stringify({ rows }) })
}

export function generateContract(orderNo) {
  return request('/contracts/generate', { method: 'POST', body: JSON.stringify({ orderNo }) })
}

export function getContractFillSources() {
  return request('/contracts/fill-sources')
}

export function previewContract(id) {
  return request(`/contracts/preview?id=${id}`)
}

export async function downloadContractFile(id, filename) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE_URL}/contracts/download?id=${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const ctype = res.headers.get('content-type') || ''
  if (!res.ok || ctype.includes('application/json')) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.message || '下载失败')
  }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || '网络服务合同.docx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(a.href)
}

export function getPoolConfig() {
  return request('/pool/config')
}

export function updatePoolConfig(data) {
  return request('/pool/config', { method: 'PUT', body: JSON.stringify(data) })
}

export function importPublicPool(rows) {
  return request('/public-pool/import', { method: 'POST', body: JSON.stringify({ rows }) })
}

export function createPublicPoolCustomer(data) {
  return request('/public-pool', { method: 'POST', body: JSON.stringify(data) })
}

export function updateContact(data) {
  return request('/contacts', { method: 'PUT', body: JSON.stringify(data) })
}

export function importContacts(rows) {
  return request('/contacts/import', { method: 'POST', body: JSON.stringify({ rows }) })
}

export function getReturnLogs() {
  return request('/pool/return-logs')
}

export function runPoolAutoReturn() {
  return request('/pool/auto-return/run', { method: 'POST', body: '{}' })
}

export function createStockOut(data) {
  return request('/stock/out', { method: 'POST', body: JSON.stringify(data) })
}

export function importStockOut(rows) {
  return request('/stock/out/import', { method: 'POST', body: JSON.stringify({ rows }) })
}

export function createStockIn(data) {
  return request('/stock/in', { method: 'POST', body: JSON.stringify(data) })
}

export function updateStockIn(data) {
  return request('/stock/in', { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteStockIn(id) {
  return request(`/stock/in?id=${id}`, { method: 'DELETE' })
}

export function importStockIn(rows) {
  return request('/stock/in/import', { method: 'POST', body: JSON.stringify({ rows }) })
}

export function createSimStockIn(data) {
  return request('/stock/sim-in', { method: 'POST', body: JSON.stringify(data) })
}

export function updateSimStockIn(data) {
  return request('/stock/sim-in', { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteSimStockIn(id) {
  return request(`/stock/sim-in?id=${id}`, { method: 'DELETE' })
}

export function importSimStockIn(rows) {
  return request('/stock/sim-in/import', { method: 'POST', body: JSON.stringify({ rows }) })
}
