import { registerMock, request } from './request'
import { getCurrentUser, getDataScope } from '../rbac/utils'
import { workOrders as seedOrders, installers as INSTALLERS, contracts, delay } from '../mock/data'

let orderStore = JSON.parse(JSON.stringify(seedOrders))
let orderSeq = orderStore.length

function nowStr() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function appendLog(order, action, operator, detail) {
  if (!order.flowLogs) order.flowLogs = []
  order.flowLogs.unshift({ time: nowStr(), action, operator, detail })
}

function findOrder(id) {
  return orderStore.find((o) => o.id === id)
}

function filterOrders(items, params = {}) {
  let list = [...items]
  const { keyword, status, mac, iccid, contractNo, deviceModel } = params
  if (status) list = list.filter((o) => o.status === status)
  if (keyword) {
    const kw = keyword.toLowerCase()
    list = list.filter((o) =>
      o.orderNo.toLowerCase().includes(kw)
      || o.customerName.includes(keyword)
      || o.storeName.includes(keyword)
      || o.contact?.includes(keyword)
      || o.contactPhone?.includes(keyword),
    )
  }
  if (mac) list = list.filter((o) => o.mac?.includes(mac))
  if (iccid) list = list.filter((o) => o.iccid?.includes(iccid))
  if (deviceModel) list = list.filter((o) => o.deviceModel?.includes(deviceModel))
  if (contractNo) {
    const orderNos = contracts.filter((c) => c.contractNo.includes(contractNo)).map((c) => c.orderNo)
    list = list.filter((o) => orderNos.includes(o.orderNo))
  }
  return list
}

function filterByDataScope(list) {
  const user = getCurrentUser()
  const scope = getDataScope()
  if (scope === 'ASSIGNED' && user.name) {
    return list.filter((o) => o.installer === user.name)
  }
  if (scope === 'SELF' && user.name) {
    return list.filter((o) => o.salesName === user.name)
  }
  return list
}

registerMock('GET', '/work-orders', async (_, params = {}) => {
  await delay()
  const list = filterByDataScope(filterOrders(orderStore, params))
  return { list, total: list.length }
})

registerMock('GET', '/work-orders/my', async (_, params = {}) => {
  await delay()
  const user = getCurrentUser()
  let list = orderStore.filter((o) => ['已派工', '安装中', '已安装', '失败'].includes(o.status))
  if (params.installer) list = list.filter((o) => o.installer === params.installer)
  else if (getDataScope() === 'ASSIGNED') list = list.filter((o) => o.installer === user.name)
  return { list, total: list.length }
})

registerMock('POST', '/work-orders', async (body) => {
  await delay()
  orderSeq += 1
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const user = getCurrentUser()
  const item = {
    id: orderSeq,
    orderNo: `GD-${day}-${String(orderSeq).padStart(3, '0')}`,
    status: '待派工',
    installer: '',
    deviceSupplier: '', deviceModel: '', mac: '', imei: '',
    simSupplier: '', operator: '', iccid: '', installRemark: '',
    salesName: user.name || '张三',
    flowLogs: [],
    ...body,
  }
  appendLog(item, '创建工单', user.name || '销售', '销售接单')
  orderStore.unshift(item)
  return item
})

registerMock('PUT', '/work-orders/dispatch', async (body) => {
  await delay()
  const order = findOrder(body.id)
  if (!order) throw new Error('工单不存在')
  const user = getCurrentUser()
  Object.assign(order, { installer: body.installer, status: '已派工', failReason: '' })
  appendLog(order, '派工', user.name || '管理员', `派给 ${body.installer}`)
  return order
})

registerMock('PUT', '/work-orders/status', async (body) => {
  await delay()
  const order = findOrder(body.id)
  if (!order) throw new Error('工单不存在')
  const user = getCurrentUser()
  order.status = body.status
  if (body.failReason) {
    order.failReason = body.failReason
    appendLog(order, '安装失败', user.name || order.installer, body.failReason)
  } else if (body.status === '安装中') {
    appendLog(order, '开始安装', user.name || order.installer, '状态 → 安装中')
  } else if (body.status === '已完成') {
    appendLog(order, '确认完成', user.name || '管理员', '工单完结')
  }
  return order
})

registerMock('PUT', '/work-orders/update', async (body) => {
  await delay()
  const { id, ...rest } = body
  const order = findOrder(id)
  if (!order) throw new Error('工单不存在')
  Object.assign(order, rest)
  return order
})

registerMock('PUT', '/work-orders/install', async (body) => {
  await delay()
  const { id, ...rest } = body
  const order = findOrder(id)
  if (!order) throw new Error('工单不存在')
  const user = getCurrentUser()
  Object.assign(order, { ...rest, status: '已安装' })
  const detail = `${order.deviceSupplier || ''}${order.deviceModel || ''} / MAC ${order.mac || '-'}`
  appendLog(order, '安装登记', user.name || order.installer, detail)
  return order
})

registerMock('DELETE', '/work-orders', async (body) => {
  await delay()
  orderStore = orderStore.filter((o) => o.id !== body.id)
  return true
})

registerMock('GET', '/installers', async () => {
  await delay(100)
  return INSTALLERS
})

export function getWorkOrderStore() {
  return orderStore
}

export function getWorkOrders(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/work-orders?${qs}`)
}

export function createWorkOrder(data) {
  return request('/work-orders', { method: 'POST', body: JSON.stringify(data) })
}

export function dispatchWorkOrder(id, installer) {
  return request('/work-orders/dispatch', { method: 'PUT', body: JSON.stringify({ id, installer }) })
}

export function updateWorkOrderStatus(id, status) {
  return request('/work-orders/status', { method: 'PUT', body: JSON.stringify({ id, status }) })
}

export function deleteWorkOrder(id) {
  return request('/work-orders', { method: 'DELETE', body: JSON.stringify({ id }) })
}

export function getInstallers() {
  return request('/installers')
}

export function updateWorkOrder(id, data) {
  return request('/work-orders/update', { method: 'PUT', body: JSON.stringify({ id, ...data }) })
}

export function installRegister(id, data) {
  return request('/work-orders/install', { method: 'PUT', body: JSON.stringify({ id, ...data }) })
}

export function getMyWorkOrders(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/work-orders/my?${qs}`)
}

export function updateWorkOrderStatusWithReason(id, status, failReason) {
  return request('/work-orders/status', { method: 'PUT', body: JSON.stringify({ id, status, failReason }) })
}

export function queryWorkOrders(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/work-orders?${qs}`)
}
