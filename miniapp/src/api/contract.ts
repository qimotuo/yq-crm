import { request } from '@/utils/request'

export interface ContractRecord {
  id: number
  contractNo: string
  orderNo: string
  customerName: string
  storeName: string
  package: string
  amount: number
  startDate: string
  endDate: string
  status: string
}

export function getContractByOrder(orderNo: string) {
  return request<{ list: ContractRecord[] }>('/contracts', { data: { orderNo } })
}
