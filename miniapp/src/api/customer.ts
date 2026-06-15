import { request } from '@/utils/request'

export interface Customer {
  id: number
  workOrderId?: number
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
  deviceSupplier?: string
  deviceModel?: string
  mac?: string
  imei?: string
  simSupplier?: string
  operator?: string
  iccid?: string
  backupIccid?: string
}

export interface CustomerSearchParams {
  keyword?: string
  mac?: string
  imei?: string
  iccid?: string
}

export function getCustomers(params: CustomerSearchParams = {}) {
  return request<{ list: Customer[] }>('/customers', { data: params })
}

export function getCustomerDetail(id: number) {
  return request<Customer>('/customers/detail', { data: { id } })
}

export function updateCustomer(id: number, data: Record<string, string>) {
  return request('/customers/update', { method: 'PUT', data: { id, ...data } })
}

export function createCustomer(data: {
  storeName: string
  customerName: string
  contact?: string
  phone?: string
  address?: string
}) {
  return request<Customer>('/customers', { method: 'POST', data })
}
