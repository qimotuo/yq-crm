import { request } from '@/utils/request'

export interface FollowUp {
  id: number
  customerId: number
  customerName: string
  salesName: string
  type: string
  content: string
  nextPlan?: string
  createTime: string
}

export function getFollowUps(customerId?: number) {
  return request<{ list: FollowUp[] }>('/follow-ups', {
    data: customerId ? { customerId } : {},
  })
}

export function createFollowUp(data: {
  customerId: number
  customerName: string
  type: string
  content: string
  nextPlan?: string
}) {
  return request('/follow-ups', { method: 'POST', data })
}
