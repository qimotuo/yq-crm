import type { WorkOrder } from '@/api/workOrder'

export function formatInstallRecord(order: WorkOrder): string {
  const lines = [
    `期：${order.installDate || '-'}`,
    `门店：${order.storeName || order.customerName || '-'}`,
    `设备型号:${order.deviceModel || '-'}`,
    `MAC:${order.mac || ''}`,
    `IMEI：${order.imei || ''}`,
    `主卡号: ${order.iccid || ''}`,
    `备用卡：${order.backupIccid || ''}`,
  ]
  return lines.join('\n')
}
