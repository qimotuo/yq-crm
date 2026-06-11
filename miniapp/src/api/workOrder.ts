import { request } from '@/utils/request'

export interface WorkOrder {
  id: number
  orderNo: string
  customerName: string
  storeName?: string
  address: string
  contact: string
  contactPhone: string
  installDate?: string
  status: string
  installer?: string
  salesName?: string
  remark?: string
  deviceSupplier?: string
  deviceModel?: string
  mac?: string
  imei?: string
  simSupplier?: string
  operator?: string
  iccid?: string
  backupIccid?: string
  installRemark?: string
  installPhotos?: string[]
  failReason?: string
}

export interface InstallSearchParams {
  customerName?: string
  storeName?: string
  installDate?: string
  mac?: string
  imei?: string
  iccid?: string
}

export interface InstallFormData {
  installDate?: string
  storeName?: string
  customerName?: string
  deviceModel?: string
  mac?: string
  imei?: string
  iccid?: string
  backupIccid?: string
  status?: string
  installRemark?: string
  failReason?: string
}

export const INSTALL_STATUSES = ['已安装', '安装中', '已派工', '待派工', '失败']

export function searchInstallations(params: InstallSearchParams) {
  return request<{ list: WorkOrder[] }>('/installations/search', { data: params })
}

export function getInstallationDetail(id: number) {
  return request<WorkOrder>('/installations/detail', { data: { id } })
}

export function createInstallation(data: InstallFormData) {
  return request<WorkOrder>('/installations', { method: 'POST', data })
}

export function updateInstallation(id: number, data: InstallFormData) {
  return request<WorkOrder>('/installations/update', { method: 'PUT', data: { id, ...data } })
}

export function getMyWorkOrders(params: { installer?: string } = {}) {
  return request<{ list: WorkOrder[] }>('/work-orders/my', { data: params })
}

export function updateWorkOrderStatus(id: number, status: string, failReason?: string) {
  return request('/work-orders/status', {
    method: 'PUT',
    data: { id, status, failReason },
  })
}

export function installRegister(id: number, data: Record<string, unknown>) {
  return request('/work-orders/install', {
    method: 'PUT',
    data: { id, ...data },
  })
}
