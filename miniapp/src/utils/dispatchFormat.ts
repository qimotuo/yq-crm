import type { WorkOrder } from '@/api/workOrder'

export interface DispatchForm {
  storeName?: string
  address?: string
  contact?: string
  contactPhone?: string
  installTimeSlot?: string
  remark?: string
  price?: string
}

export function formatDispatchRecord(order: Partial<WorkOrder>): string {
  const lines = [
    `店名：${order.storeName || '-'}`,
    `地址：${order.address || '-'}`,
    `联系人：${order.contact || '-'}`,
    `联系人电话：${order.contactPhone || ''}`,
    `时间：${order.installTimeSlot || order.installDate || '-'}`,
    `备注：${order.remark || order.installRemark || ''}`,
    `价格：${order.price || '-'}`,
  ]
  if (order.status === '推迟安装' && order.postponeDate) {
    lines.push(`推迟至：${order.postponeDate}`)
  }
  if (order.status === '失败' && order.failReason) {
    lines.push(`失败原因：${order.failReason}`)
  }
  return lines.join('\n')
}

export function buildDispatchPayload(form: DispatchForm) {
  return {
    storeName: form.storeName?.trim(),
    customerName: form.storeName?.trim(),
    address: form.address?.trim(),
    contact: form.contact?.trim(),
    contactPhone: form.contactPhone?.trim(),
    installTimeSlot: form.installTimeSlot?.trim(),
    installDate: form.installTimeSlot?.trim(),
    remark: form.remark?.trim(),
    price: form.price?.trim(),
  }
}
