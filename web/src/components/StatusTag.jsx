import { Tag } from 'antd'
import { getOrderStatusColor, getPaymentStatusColor } from '../utils/helpers'

export function OrderStatusTag({ status }) {
  return <Tag color={getOrderStatusColor(status)}>{status}</Tag>
}

export function PaymentStatusTag({ status }) {
  return <Tag color={getPaymentStatusColor(status)}>{status}</Tag>
}
