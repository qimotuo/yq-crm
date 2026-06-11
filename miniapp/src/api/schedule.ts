import { request } from '@/utils/request'

export interface Schedule {
  id: number
  title: string
  customerName: string
  salesName: string
  date: string
  time: string
  type: string
  status: string
}

export function getSchedules(date = '') {
  return request<{ list: Schedule[] }>('/schedules', { data: date ? { date } : {} })
}

export function completeSchedule(id: number) {
  return request('/schedules/complete', { method: 'PUT', data: { id } })
}
