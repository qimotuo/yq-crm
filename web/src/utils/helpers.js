const STATUS_COLOR = {
  待派工: 'default',
  已派工: 'processing',
  安装中: 'warning',
  已安装: 'success',
  已完成: 'success',
  失败: 'error',
}

const PAYMENT_COLOR = {
  已回款: 'success',
  部分回款: 'warning',
  已逾期: 'error',
  未回款: 'default',
}

export function getOrderStatusColor(status) {
  return STATUS_COLOR[status] || 'default'
}

export function getPaymentStatusColor(status) {
  return PAYMENT_COLOR[status] || 'default'
}

export function formatMoney(val) {
  return `¥${Number(val).toLocaleString()}`
}
