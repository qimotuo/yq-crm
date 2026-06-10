/** 回款状态与进度计算 */
export function calcPaymentStatus(totalAmount, paidAmount, paymentPlanDate) {
  const unpaidAmount = totalAmount - paidAmount
  let paymentStatus = '未回款'
  let paymentProgress = 0

  if (paidAmount >= totalAmount) {
    paymentStatus = '已回款'
    paymentProgress = 100
  } else if (paidAmount > 0) {
    paymentStatus = '部分回款'
    paymentProgress = Math.round((paidAmount / totalAmount) * 100)
    if (paymentPlanDate && new Date(paymentPlanDate) < new Date()) {
      paymentStatus = '已逾期'
    }
  } else if (paymentPlanDate && new Date(paymentPlanDate) < new Date()) {
    paymentStatus = '已逾期'
  }

  return { unpaidAmount, paymentStatus, paymentProgress }
}
