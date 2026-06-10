import { registerMock, request } from './request'
import { schedules, notifications, systemUsers, roles, delay } from '../mock/data'
import { DEFAULT_ROLES } from '../rbac/config'
import { getCurrentUser } from '../rbac/utils'

const todayStr = () => new Date().toISOString().slice(0, 10)
let scheduleStore = schedules.map((s, i) => (i < 2 ? { ...s, date: todayStr() } : s))
let notificationStore = [...notifications]
let broadcastStore = []
let broadcastId = 1

const SITE_TEMPLATES = [
  { code: 'system_notice', type: '系统', title: '系统公告', content: '请查看最新系统通知', path: '/dashboard', enabled: true },
  { code: 'workorder_pending_dispatch', type: '工单', title: '待派工提醒', content: '{count} 个工单等待派工', path: '/dispatch', enabled: true },
  { code: 'finance_overdue', type: '财务', title: '回款逾期提醒', content: '{customer_name} 账单已逾期', path: '/finance', enabled: true },
  { code: 'stock_low', type: '库存', title: '库存预警', content: '{item_name} 库存仅剩 {count}', path: '/stock', enabled: true },
  { code: 'schedule_reminder', type: '日程', title: '今日日程提醒', content: '{time} {title}', path: '/schedules', enabled: true },
]

const MINIPROGRAM_TEMPLATES = [
  { code: 'mp_workorder_dispatch', type: '工单', title: '派工通知', content: '您有新的安装任务：{{orderNo}}', enabled: false },
  { code: 'mp_payment_remind', type: '财务', title: '回款提醒', content: '{{customerName}} 账单待回款 ¥{{amount}}', enabled: false },
  { code: 'mp_schedule_remind', type: '日程', title: '日程提醒', content: '{{time}} {{title}}', enabled: false },
]

function resolveMockRecipients(body) {
  const enabled = systemUsers.filter((u) => u.enabled !== false)
  if (body.targetType === 'all') return enabled
  if (body.targetType === 'roles') {
    const codes = body.roleCodes || []
    return enabled.filter((u) => codes.includes(u.role))
  }
  if (body.targetType === 'users') {
    const ids = body.userIds || []
    return enabled.filter((u) => ids.includes(u.id))
  }
  return []
}

function buildTargetLabel(body) {
  if (body.targetType === 'all') return '全部用户'
  if (body.targetType === 'roles') {
    const names = (body.roleCodes || []).map((c) => roles.find((r) => r.code === c)?.name || c)
    return names.join('、') || '-'
  }
  const names = (body.userIds || []).map((id) => systemUsers.find((u) => u.id === id)?.name || id)
  return names.join('、') || '-'
}

export function getScheduleStore() {
  return scheduleStore
}

registerMock('GET', '/schedules', async (_, params = {}) => {
  await delay()
  let list = [...scheduleStore]
  if (params.date) list = list.filter((s) => s.date === params.date)
  if (params.salesName) list = list.filter((s) => s.salesName === params.salesName)
  return { list, total: list.length }
})

registerMock('POST', '/schedules', async (body) => {
  await delay()
  const item = { id: scheduleStore.length + 1, status: '待执行', salesName: body.salesName || '当前用户', ...body }
  scheduleStore.unshift(item)
  return item
})

registerMock('PUT', '/schedules/complete', async (body) => {
  await delay()
  scheduleStore = scheduleStore.map((s) => (s.id === body.id ? { ...s, status: '已完成' } : s))
  return scheduleStore.find((s) => s.id === body.id)
})

registerMock('GET', '/notifications', async () => {
  await delay(100)
  const unread = notificationStore.filter((n) => !n.read).length
  return { list: notificationStore, unread }
})

registerMock('PUT', '/notifications/read', async (body) => {
  await delay(50)
  if (body.id) {
    notificationStore = notificationStore.map((n) => (n.id === body.id ? { ...n, read: true } : n))
  } else {
    notificationStore = notificationStore.map((n) => ({ ...n, read: true }))
  }
  return true
})

registerMock('GET', '/notifications/templates', async () => {
  await delay(50)
  return { site: SITE_TEMPLATES, miniprogram: MINIPROGRAM_TEMPLATES }
})

registerMock('GET', '/notifications/admin/records', async (_, params = {}) => {
  await delay()
  const page = Number(params.page) || 1
  const size = Number(params.size) || 10
  const start = (page - 1) * size
  const list = broadcastStore.slice(start, start + size)
  return { list, total: broadcastStore.length, page, size }
})

registerMock('POST', '/notifications/admin/send', async (body) => {
  await delay(200)
  const recipients = resolveMockRecipients(body)
  if (!recipients.length) throw new Error('未找到符合条件的接收用户')
  const channels = body.channels || ['site']
  const sender = getCurrentUser()
  const id = broadcastId++
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  if (channels.includes('site')) {
    let nextId = notificationStore.length ? Math.max(...notificationStore.map((n) => n.id)) + 1 : 1
    recipients.forEach((u) => {
      notificationStore.unshift({
        id: nextId++,
        type: body.type || '系统',
        title: body.title,
        content: body.content,
        time: '刚刚',
        read: false,
        path: body.path || '',
      })
    })
  }
  broadcastStore.unshift({
    id,
    title: body.title,
    content: body.content,
    type: body.type || '系统',
    targetType: body.targetType,
    targetLabel: buildTargetLabel(body),
    targetDetail: JSON.stringify({ roleCodes: body.roleCodes, userIds: body.userIds }),
    channels,
    recipientCount: recipients.length,
    senderName: sender?.name || '管理员',
    createdAt: now,
  })
  return { broadcastId: id, recipientCount: recipients.length }
})

registerMock('GET', '/system/users', async () => {
  await delay(50)
  return { list: systemUsers }
})

registerMock('GET', '/system/roles', async () => {
  await delay(50)
  return {
    list: DEFAULT_ROLES.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      userCount: r.userCount,
      dataScope: r.dataScope,
      enabled: r.enabled,
    })),
  }
})

registerMock('GET', '/system/logs', async (_, params = {}) => {
  await delay(50)
  return { list: [], total: 0, page: Number(params.page) || 1, size: Number(params.size) || 20 }
})

export function getNotifications() {
  return request('/notifications')
}

export function markNotificationRead(id) {
  return request('/notifications/read', { method: 'PUT', body: JSON.stringify(id ? { id } : {}) })
}

export function getSchedules(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/schedules?${qs}`)
}

export function createSchedule(data) {
  return request('/schedules', { method: 'POST', body: JSON.stringify(data) })
}

export function completeSchedule(id) {
  return request('/schedules/complete', { method: 'PUT', body: JSON.stringify({ id }) })
}

export function getOperationLogs(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/system/logs?${qs}`)
}

export function getNotifyTemplates() {
  return request('/notifications/templates')
}

export function getNotifySendRecords(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/notifications/admin/records?${qs}`)
}

export function sendAdminNotification(data) {
  return request('/notifications/admin/send', { method: 'POST', body: JSON.stringify(data) })
}
