import { request } from '@/utils/request'

export interface Customer {
  id: number
  storeName?: string
  customerName: string
  contact?: string
  phone?: string
  address?: string
  salesName?: string
  contactStatus?: string
  wechatId?: string
  lastFollowTime?: string
  orderNo?: string
  installDate?: string
}

export function getCustomers(keyword = '') {
  return request<{ list: Customer[] }>('/customers', { data: { keyword } })
}

export function getCustomerDetail(id: number) {
  return request<Customer>('/customers/detail', { data: { id } })
}

export function updateCustomer(id: number, data: Record<string, string>) {
  return request('/customers/update', { method: 'PUT', data: { id, ...data } })
}
