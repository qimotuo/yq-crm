import { request } from '@/utils/request'

export interface PublicPoolCustomer {
  id: number
  storeName: string
  customerName: string
  contact?: string
  phone?: string
  address?: string
  source?: string
  status?: string
}

export function getPublicPool(keyword = '') {
  return request<{ list: PublicPoolCustomer[] }>('/public-pool', {
    data: keyword ? { keyword } : {},
  })
}

export function claimPublicPool(id: number) {
  return request('/public-pool/claim', { method: 'POST', data: { id } })
}
