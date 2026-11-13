import { request } from './request'

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
