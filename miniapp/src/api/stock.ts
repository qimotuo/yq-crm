import { request } from '@/utils/request'

export interface StockOutForm {
  orderNo: string
  model: string
  mac: string
  imei?: string
  iccid?: string
  iccid2?: string
  operator?: string
  receiver?: string
  remark?: string
  storeName?: string
  customerName?: string
  address?: string
}

export function createStockOut(data: StockOutForm) {
  return request('/stock/out', { method: 'POST', data })
}
