import { registerMock, request } from './request'
import { getCurrentUser } from '../rbac/utils'
import { calcPaymentStatus } from '../utils/finance'
import { buildDashboardStats } from '../utils/dashboardStats'
import { getWorkOrderStore } from './workOrder'
import { getScheduleStore } from './notify'
import { DEFAULT_ROLES } from '../rbac/config'
import { customers, financeList, stockInList, stockOutList, simStockInList, publicPoolCustomers, followUps, integratedList, contacts, contracts, poolConfig, returnLogs, systemUsers, accountLedgerList, adminLedgerList, delay } from '../mock/data'

let customerStore = [...customers]
let financeStore = [...financeList]
let accountLedgerStore = [...accountLedgerList]
let adminLedgerStore = [...adminLedgerList]
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
let stockInStore = [...stockInList]
let simStockInStore = [...simStockInList]
let stockOutStore = [...stockOutList]

function genStockInNo(store) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const seq = store.length + 1
  return `RK${date}${String(seq).padStart(3, '0')}`
}

function stockNow() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function normalizeStockDatetime(value) {
  if (!value) return stockNow()
  const text = String(value).trim()
  if (text.length <= 10) return `${text} 00:00:00`
  return text
}
let poolConfigStore = { ...poolConfig }
let returnLogStore = [...returnLogs]

const PHONE_RE = /^1\d{10}$/
function validatePhone(phone) {
  if (phone && !PHONE_RE.test(phone)) throw new Error('手机号格式不正确，需为11位数字')
}
function nowStr() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

function filterCustomers(list, params = {}) {
  let result = [...list]
  const {
    keyword, salesName, contactStatus, invoiceType, orderNo, mac, iccid, operator, installed, hasPayment,
  } = params
  if (salesName) result = result.filter((c) => (c.salesName || '').includes(salesName))
  if (contactStatus) result = result.filter((c) => c.contactStatus === contactStatus)
  if (invoiceType) result = result.filter((c) => c.invoiceType === invoiceType)
  if (keyword) {
    result = result.filter((c) =>
      (c.customerName || '').includes(keyword)
      || (c.storeName || '').includes(keyword)
      || (c.phone || '').includes(keyword)
      || (c.contact || '').includes(keyword))
  }
  if (orderNo) result = result.filter((c) => (c.orderNo || '').includes(orderNo))
  if (mac) result = result.filter((c) => (c.mac || '').includes(mac))
  if (iccid) {
    result = result.filter((c) =>
      (c.iccid || '').includes(iccid)
      || (c.iccid2 || '').includes(iccid)
      || (c.backupIccid || '').includes(iccid))
  }
  if (operator) result = result.filter((c) => (c.operator || '').includes(operator))
  if (installed === 'yes') result = result.filter((c) => c.installDate || c.mac)
  if (installed === 'no') result = result.filter((c) => !c.installDate && !c.mac)
  if (hasPayment === 'yes') result = result.filter((c) => c.lastPaymentTime)
  if (hasPayment === 'no') result = result.filter((c) => !c.lastPaymentTime)
  return result
}

registerMock('GET', '/customers', async (body, params = {}) => {
  await delay()
  let list = filterCustomers(customerStore, params)
  return { list, total: list.length }
})

registerMock('GET', '/customers/detail', async (body, params) => {
  await delay(100)
  return customerStore.find((c) => c.id === Number(params.id))
})

registerMock('PUT', '/customers/update', async (body) => {
  await delay()
  const patch = { ...body, backupIccid: body.iccid2 || body.backupIccid || '' }
  customerStore = customerStore.map((c) => (c.id === body.id ? { ...c, ...patch } : c))
  return customerStore.find((c) => c.id === body.id)
})

registerMock('POST', '/customers', async (body) => {
  await delay()
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const nextId = customerStore.reduce((max, c) => Math.max(max, c.id), 0) + 1
  const isPrivate = Boolean(body.salesName)
  const item = {
    id: nextId,
    contactStatus: isPrivate ? '待跟进' : (body.contactStatus || '正常'),
    financeId: null,
    lastPaymentTime: '',
    lastPaymentAmount: 0,
    claimTime: isPrivate ? now : (body.claimTime || ''),
    lastFollowTime: '',
    wechatId: '',
    orderNo: '',
    installDate: '',
    deviceSupplier: '',
    deviceModel: '',
    mac: '',
    imei: '',
    iccid: '',
    iccid2: '',
    backupIccid: '',
    operator: '',
    simSupplier: '',
    contractPeriod: '',
    invoiceType: '增值税普通发票',
    ...body,
    backupIccid: body.iccid2 || body.backupIccid || '',
  }
  customerStore.unshift(item)
  return item
})

registerMock('DELETE', '/customers', async (body, params) => {
  await delay()
  const id = Number(params.id)
  customerStore = customerStore.filter((c) => c.id !== id)
  return true
})

registerMock('POST', '/customers/my-import', async (body) => {
  await delay()
  const rows = body.rows || []
  if (!rows.length) throw new Error('导入数据为空')
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const salesName = body.salesName || rows[0]?.salesName || '张三'
  let nextId = customerStore.reduce((max, c) => Math.max(max, c.id), 0)
  const newItems = rows.map((row, idx) => {
    if (!row.storeName || !row.customerName) {
      throw new Error(`第 ${idx + 2} 行：店名和客户名称为必填项`)
    }
    validatePhone(row.phone)
    nextId += 1
    return {
      id: nextId,
      storeName: row.storeName,
      customerName: row.customerName,
      contact: row.contact || '',
      phone: row.phone || '',
      address: row.address || '',
      salesName,
      contactStatus: '待跟进',
      financeId: null,
      lastPaymentTime: '',
      lastPaymentAmount: 0,
      claimTime: now,
      lastFollowTime: '',
      wechatId: '',
      orderNo: '',
      installDate: '',
      deviceSupplier: '',
      deviceModel: '',
      mac: '',
      imei: '',
      iccid: '',
      iccid2: '',
      backupIccid: '',
      operator: '',
      simSupplier: '',
      contractPeriod: '',
      invoiceType: '增值税普通发票',
      source: '导入',
    }
  })
  customerStore = [...newItems, ...customerStore]
  return { count: newItems.length, list: newItems }
})

registerMock('POST', '/customers/import', async (body) => {
  await delay()
  const rows = body.rows || []
  if (!rows.length) throw new Error('导入数据为空')
  let nextId = customerStore.reduce((max, c) => Math.max(max, c.id), 0)
  const newItems = rows.map((row, idx) => {
    if (!row.storeName || !row.customerName) {
      throw new Error(`第 ${idx + 2} 行：店名和客户名称为必填项`)
    }
    validatePhone(row.phone)
    nextId += 1
    return {
      id: nextId,
      contactStatus: row.contactStatus || '正常',
      financeId: null,
      lastPaymentTime: '',
      lastPaymentAmount: 0,
      claimTime: '',
      lastFollowTime: '',
      wechatId: '',
      orderNo: '',
      installDate: '',
      deviceSupplier: '',
      deviceModel: '',
      mac: '',
      imei: '',
      iccid: '',
      iccid2: '',
      backupIccid: '',
      operator: '',
      simSupplier: '',
      contractPeriod: '',
      invoiceType: '增值税普通发票',
      source: '导入',
      ...row,
      backupIccid: row.iccid2 || row.backupIccid || '',
    }
  })
  customerStore = [...newItems, ...customerStore]
  return { count: newItems.length, list: newItems }
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
  if (params.type) list = list.filter((f) => f.type === params.type)
  if (params.salesName) list = list.filter((f) => f.salesName?.includes(params.salesName))
  if (params.keyword) list = list.filter((f) => f.content?.includes(params.keyword))
  if (params.status) list = list.filter((f) => f.status === params.status)
  return { list, total: list.length }
})

registerMock('POST', '/follow-ups', async (body) => {
  await delay()
  const ts = nowStr()
  const status = body.status || (body.nextPlan ? '待完成' : '已完成')
  const item = { id: followUpStore.length + 1, createTime: ts, status, ...body }
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

function buildFinanceRecord(body, id) {
  const total = Number(body.totalAmount) || 0
  const paid = Number(body.paidAmount) || 0
  const calc = calcPaymentStatus(total, paid, body.paymentPlanDate)
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: id || (financeStore.length ? Math.max(...financeStore.map((f) => f.id)) + 1 : 1),
    storeName: body.storeName || '',
    customerName: body.customerName || '',
    orderNo: body.orderNo || '',
    package: body.package || '',
    billMonth: body.billMonth || today.slice(0, 7),
    contractPeriod: body.contractPeriod || '',
    contractStatus: body.contractStatus || '正常',
    totalAmount: total,
    paidAmount: paid,
    unpaidAmount: calc.unpaidAmount,
    paymentStatus: calc.paymentStatus,
    paymentProgress: calc.paymentProgress,
    invoiceStatus: body.invoiceStatus || '待开票',
    salesName: body.salesName || '',
    paymentPlanDate: body.paymentPlanDate || '',
    lastPaymentTime: paid > 0 ? today : '',
    paymentRecords: [],
  }
}

function linkCustomerFinance(orderNo, financeId) {
  customerStore = customerStore.map((c) =>
    c.orderNo === orderNo ? { ...c, financeId } : c,
  )
}

registerMock('POST', '/finance', async (body) => {
  await delay()
  if (financeStore.some((f) => f.orderNo === body.orderNo)) throw new Error(`工单 ${body.orderNo} 已存在财务账单`)
  const item = buildFinanceRecord(body)
  financeStore.unshift(item)
  linkCustomerFinance(body.orderNo, item.id)
  syncFinanceRelated(item)
  return item
})

registerMock('POST', '/finance/import', async (body) => {
  await delay(600)
  const newItems = (body.rows || [])
    .filter((row) => !financeStore.some((f) => f.orderNo === row.orderNo))
    .map((row) => {
      const item = buildFinanceRecord(row)
      financeStore.unshift(item)
      linkCustomerFinance(row.orderNo, item.id)
      syncFinanceRelated(item)
      return item
    })
  return { count: newItems.length, list: newItems }
})

function filterByMonth(list, month) {
  if (!month) return list
  return list.filter((r) => r.entryDate?.startsWith(month))
}

function nextLedgerId(store) {
  return store.length ? Math.max(...store.map((r) => r.id)) + 1 : 1
}

registerMock('GET', '/account-ledger', async (body, params = {}) => {
  await delay()
  let list = [...accountLedgerStore]
  if (params.section) list = list.filter((r) => r.section === params.section)
  if (params.month) list = filterByMonth(list, params.month)
  if (params.direction) list = list.filter((r) => r.direction === params.direction)
  return { list, total: list.length }
})

registerMock('POST', '/account-ledger', async (body) => {
  await delay()
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const item = {
    id: nextLedgerId(accountLedgerStore),
    section: body.section,
    direction: body.direction,
    category: body.category,
    amount: Number(body.amount) || 0,
    entryDate: body.entryDate,
    remark: body.remark || '',
    remarkOption: body.remarkOption || '',
    createdBy: body.createdBy || '',
    createTime: now,
  }
  accountLedgerStore.unshift(item)
  return item
})

registerMock('DELETE', '/account-ledger', async (body, params) => {
  await delay()
  const id = Number(params.id)
  accountLedgerStore = accountLedgerStore.filter((r) => r.id !== id)
  return { ok: true }
})

registerMock('GET', '/admin-ledger', async (body, params = {}) => {
  await delay()
  let list = [...adminLedgerStore]
  if (params.month) list = filterByMonth(list, params.month)
  if (params.category) list = list.filter((r) => r.category === params.category)
  return { list, total: list.length }
})

registerMock('POST', '/admin-ledger', async (body) => {
  await delay()
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const item = {
    id: nextLedgerId(adminLedgerStore),
    category: body.category,
    amount: Number(body.amount) || 0,
    entryDate: body.entryDate,
    remark: body.remark || '',
    createdBy: body.createdBy || '',
    createTime: now,
  }
  adminLedgerStore.unshift(item)
  return item
})

registerMock('DELETE', '/admin-ledger', async (body, params) => {
  await delay()
  const id = Number(params.id)
  adminLedgerStore = adminLedgerStore.filter((r) => r.id !== id)
  return { ok: true }
})

registerMock('GET', '/stock/in', async () => {
  await delay()
  return { list: stockInStore, total: stockInStore.length }
})

registerMock('POST', '/stock/in', async (body) => {
  await delay()
  const qty = Number(body.qty) || 1
  const item = {
    id: stockInStore.length ? Math.max(...stockInStore.map((s) => s.id)) + 1 : 1,
    inNo: genStockInNo(stockInStore),
    inDate: normalizeStockDatetime(body.inDate),
    supplier: body.supplier || '',
    model: body.model || '',
    imei: body.imei || '',
    mac: body.mac || '',
    qty,
    stockQty: qty,
    receiver: body.receiver || '',
    remark: body.remark || '',
  }
  stockInStore.unshift(item)
  return item
})

registerMock('PUT', '/stock/in', async (body) => {
  await delay()
  const old = stockInStore.find((s) => s.id === body.id)
  if (!old) throw new Error('入库记录不存在')
  const newQty = Number(body.qty) || old.qty
  const updated = {
    ...old,
    ...body,
    qty: newQty,
    stockQty: (old.stockQty || 0) + (newQty - (old.qty || 0)),
  }
  stockInStore = stockInStore.map((s) => (s.id === body.id ? updated : s))
  return updated
})

registerMock('DELETE', '/stock/in', async (body, params) => {
  await delay()
  const id = Number(params.id)
  stockInStore = stockInStore.filter((s) => s.id !== id)
  return true
})

registerMock('POST', '/stock/in/import', async (body) => {
  await delay(600)
  const rows = body.rows || []
  const newItems = rows.map((row, i) => {
    const qty = Number(row.qty) || 1
    return {
      id: (stockInStore.length ? Math.max(...stockInStore.map((s) => s.id)) : 0) + i + 1,
      inNo: genStockInNo([...stockInStore, ...rows.slice(0, i)]),
      inDate: normalizeStockDatetime(row.inDate),
      supplier: row.supplier || '',
      model: row.model || '',
      imei: row.imei || '',
      mac: row.mac || '',
      qty,
      stockQty: qty,
      receiver: row.receiver || '',
      remark: row.remark || '',
    }
  })
  stockInStore = [...newItems, ...stockInStore]
  return { count: newItems.length, list: newItems }
})

registerMock('GET', '/stock/sim-in', async () => {
  await delay()
  return { list: simStockInStore, total: simStockInStore.length }
})

registerMock('POST', '/stock/sim-in', async (body) => {
  await delay()
  const qty = Number(body.qty) || 1
  const item = {
    id: simStockInStore.length ? Math.max(...simStockInStore.map((s) => s.id)) + 1 : 1,
    inNo: genStockInNo(simStockInStore),
    inDate: normalizeStockDatetime(body.inDate),
    supplier: body.supplier || '',
    operator: body.operator || '',
    iccid: body.iccid || '',
    qty,
    stockQty: qty,
    receiver: body.receiver || '',
    remark: body.remark || '',
  }
  simStockInStore.unshift(item)
  return item
})

registerMock('PUT', '/stock/sim-in', async (body) => {
  await delay()
  const old = simStockInStore.find((s) => s.id === body.id)
  if (!old) throw new Error('入库记录不存在')
  const newQty = Number(body.qty) || old.qty
  const updated = {
    ...old,
    ...body,
    qty: newQty,
    stockQty: (old.stockQty || 0) + (newQty - (old.qty || 0)),
  }
  simStockInStore = simStockInStore.map((s) => (s.id === body.id ? updated : s))
  return updated
})

registerMock('DELETE', '/stock/sim-in', async (body, params) => {
  await delay()
  const id = Number(params.id)
  simStockInStore = simStockInStore.filter((s) => s.id !== id)
  return true
})

registerMock('POST', '/stock/sim-in/import', async (body) => {
  await delay(600)
  const rows = body.rows || []
  const newItems = rows.map((row, i) => {
    const qty = Number(row.qty) || 1
    return {
      id: (simStockInStore.length ? Math.max(...simStockInStore.map((s) => s.id)) : 0) + i + 1,
      inNo: genStockInNo([...simStockInStore, ...rows.slice(0, i)]),
      inDate: normalizeStockDatetime(row.inDate),
      supplier: row.supplier || '',
      operator: row.operator || '',
      iccid: row.iccid || '',
      qty,
      stockQty: qty,
      receiver: row.receiver || '',
      remark: row.remark || '',
    }
  })
  simStockInStore = [...newItems, ...simStockInStore]
  return { count: newItems.length, list: newItems }
})

registerMock('GET', '/stock/out', async () => {
  await delay()
  return { list: stockOutStore, total: stockOutStore.length }
})

registerMock('POST', '/stock/out', async (body) => {
  await delay()
  const id = stockOutStore.length ? Math.max(...stockOutStore.map((s) => s.id)) + 1 : 1
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const item = {
    id,
    outNo: `CK${date}${String(id).padStart(3, '0')}`,
    outDate: normalizeStockDatetime(body.outDate),
    ...body,
  }
  stockOutStore.unshift(item)
  return item
})

registerMock('POST', '/stock/out/import', async (body) => {
  await delay(600)
  const orders = getWorkOrderStore()
  const rows = body.rows || []
  const baseId = stockOutStore.length ? Math.max(...stockOutStore.map((s) => s.id)) : 0
  const newItems = rows.map((row, i) => {
    const order = orders.find((o) => o.orderNo === row.orderNo)
    const id = baseId + i + 1
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return {
      id,
      outNo: `CK${date}${String(id).padStart(3, '0')}`,
      outDate: normalizeStockDatetime(row.outDate),
      orderNo: row.orderNo,
      storeName: order?.storeName || '',
      customerName: order?.customerName || '',
      address: order?.address || '',
      model: row.model || '',
      imei: row.imei || '',
      mac: row.mac || '',
      iccid: row.iccid || '',
      iccid2: row.iccid2 || '',
      operator: row.operator || '',
      receiver: row.receiver || '',
      remark: row.remark || '',
    }
  })
  stockOutStore = [...newItems, ...stockOutStore]
  return { count: newItems.length, list: newItems }
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

registerMock('POST', '/contacts/import', async (body) => {
  await delay(600)
  const rows = body.rows || []
  if (!rows.length) throw new Error('导入数据为空')
  let nextId = contactStore.reduce((max, c) => Math.max(max, c.id), 0)
  const newItems = rows.map((row, idx) => {
    if (!row.customerName || !row.name || !row.phone) {
      throw new Error(`第 ${idx + 2} 行：客户名称、姓名和手机号为必填项`)
    }
    validatePhone(row.phone)
    const isPrimary = row.isPrimary === '是' || row.isPrimary === 'true' || row.isPrimary === '1'
    nextId += 1
    return {
      id: nextId,
      customerName: row.customerName,
      storeName: row.storeName || '',
      name: row.name,
      phone: row.phone,
      title: row.title || '',
      isPrimary,
    }
  })
  newItems.forEach((item) => {
    if (item.isPrimary) {
      contactStore = contactStore.map((c) => (c.customerName === item.customerName ? { ...c, isPrimary: false } : c))
    }
    contactStore.unshift(item)
  })
  return { count: newItems.length }
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

function genContractNo(cityCode = 'SH') {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const seq = contractStore.length + 1
  return `${cityCode}${d}${String(seq).padStart(3, '0')}`
}

function buildContractRecord(body, id) {
  return {
    id: id || (contractStore.length ? Math.max(...contractStore.map((c) => c.id)) + 1 : 1),
    contractNo: body.contractNo || genContractNo(body.cityCode || 'SH'),
    orderNo: body.orderNo || '',
    customerName: body.customerName || '',
    storeName: body.storeName || '',
    package: body.package || '',
    amount: Number(body.amount) || 0,
    startDate: body.startDate || '',
    endDate: body.endDate || '',
    status: body.status || '待生成',
    cityCode: body.cityCode || 'SH',
  }
}

registerMock('POST', '/contracts', async (body) => {
  await delay()
  if (contractStore.some((c) => c.orderNo === body.orderNo)) throw new Error(`工单 ${body.orderNo} 已存在合同`)
  const item = buildContractRecord(body)
  contractStore.unshift(item)
  return item
})

registerMock('POST', '/contracts/import', async (body) => {
  await delay(600)
  const newItems = (body.rows || [])
    .filter((row) => !contractStore.some((c) => c.orderNo === row.orderNo))
    .map((row) => {
      const item = buildContractRecord(row)
      contractStore.unshift(item)
      return item
    })
  return { count: newItems.length, list: newItems }
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

export function createFinance(data) {
  return request('/finance', { method: 'POST', body: JSON.stringify(data) })
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

export function getIntegratedList(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/integrated?${qs}`)
}

export function traceQuery(type, value) {
  const qs = new URLSearchParams({ type, value }).toString()
  return request(`/trace?${qs}`)
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

export function createContract(data) {
  return request('/contracts', { method: 'POST', body: JSON.stringify(data) })
}

export function importContracts(rows) {
  return request('/contracts/import', { method: 'POST', body: JSON.stringify({ rows }) })
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

export function importContacts(rows) {
  return request('/contacts/import', { method: 'POST', body: JSON.stringify({ rows }) })
}

export function getReturnLogs() {
  return request('/pool/return-logs')
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
