import { request } from '@/utils/request'

export interface FinanceRecord {
  id: number
  storeName: string
  customerName: string
  orderNo: string
  package: string
  billMonth: string
  contractPeriod: string
  contractStatus: string
  totalAmount: number
  paidAmount: number
  unpaidAmount: number
  paymentStatus: string
  paymentProgress: number
  invoiceStatus: string
  salesName: string
  paymentPlanDate: string
  lastPaymentTime: string
}

export function getFinanceByOrder(orderNo: string) {
  return request<{ list: FinanceRecord[] }>('/finance', { data: { orderNo } })
}
