export function formatInstallRecord(order) {
  return [
    `期：${order.installDate || '-'}`,
    `门店：${order.storeName || order.customerName || '-'}`,
    `设备型号:${order.deviceModel || '-'}`,
    `MAC:${order.mac || ''}`,
    `IMEI：${order.imei || ''}`,
    `主卡号: ${order.iccid || ''}`,
    `备用卡：${order.backupIccid || ''}`,
  ].join('\n')
}

export function formatDispatchRecord(order) {
  const lines = [
    `店名：${order.storeName || '-'}`,
    `客户名称：${order.customerName || '-'}`,
    `地址：${order.address || '-'}`,
    `联系人：${order.contact || '-'}`,
    `联系人电话：${order.contactPhone || ''}`,
    `时间：${order.installTimeSlot || order.installDate || '-'}`,
    `备注：${order.remark || order.installRemark || ''}`,
    `价格：${order.price || '-'}`,
  ]
  if (order.status === '推迟安装' && order.postponeDate) lines.push(`推迟至：${order.postponeDate}`)
  if (order.status === '失败' && order.failReason) lines.push(`失败原因：${order.failReason}`)
  return lines.join('\n')
}

export function buildDispatchPayload(form) {
  return {
    storeName: form.storeName?.trim(),
    customerName: form.customerName?.trim() || form.storeName?.trim(),
    address: form.address?.trim(),
    contact: form.contact?.trim(),
    contactPhone: form.contactPhone?.trim(),
    installTimeSlot: form.installTimeSlot?.trim(),
    installDate: form.installTimeSlot?.trim(),
    remark: form.remark?.trim(),
    price: String(form.price ?? '').trim(),
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
