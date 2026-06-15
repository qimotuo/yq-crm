import { request } from '@/utils/request'

export interface AppNotification {
  id: number
  type: string
  title: string
  content: string
  path: string
  read: boolean
  time: string
  templateCode: string
}

export function getNotifications() {
  return request<{ list: AppNotification[]; unread: number }>('/notifications')
}

export function markNotificationRead(id?: number) {
  return request('/notifications/read', {
    method: 'PUT',
    data: id ? { id } : {},
  })
}
