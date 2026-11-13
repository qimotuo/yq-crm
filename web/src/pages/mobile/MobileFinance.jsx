import { useEffect, useState } from 'react'
import { Card, Tag, Spin, Button, Progress, Input, message } from 'antd'
import { getFinanceList, recordPayment } from '../../api'
import PaymentModal from '../../components/PaymentModal'
import { formatMoney } from '../../utils/helpers'
import { hasOperation } from '../../utils/mobileAuth'

const STATUS_COLOR = { 已回款: 'green', 部分回款: 'orange', 未回款: 'default', 已逾期: 'red' }

export default function MobileFinance() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [payTarget, setPayTarget] = useState(null)
  const canPay = hasOperation('finance:payment')

  const load = async (kw = keyword) => {
    setLoading(true)
    try {
      const res = await getFinanceList(kw ? { keyword: kw } : {})
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load('') }, [])

  const handlePay = async (payload) => {
    await recordPayment({ id: payTarget.id, ...payload })
    message.success('回款已录入')
    setPayTarget(null)
    load()
  }

  return (
    <div>
      <div className="mobile-toolbar">
        <Input.Search
          placeholder="客户 / 店名 / 工单号"
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={(v) => load(v)}
        />
      </div>
      <Spin spinning={loading}>
        {list.length === 0 && !loading && <div className="mobile-empty">暂无账单</div>}
        {list.map((item) => (
          <Card key={item.id} className="mobile-card" size="small">
            <div className="mobile-card__title">
              <strong>{item.customerName}</strong>
              <Tag color={STATUS_COLOR[item.paymentStatus] || 'default'}>{item.paymentStatus}</Tag>
            </div>
            <div className="mobile-card__row"><span className="label">门店</span><span>{item.storeName || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">工单号</span><span>{item.orderNo || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">套餐</span><span>{item.package || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">账期</span><span>{item.billMonth || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">合同周期</span><span>{item.contractPeriod || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">合同状态</span><span>{item.contractStatus || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">应收</span><span>{formatMoney(item.totalAmount)}</span></div>
            <div className="mobile-card__row"><span className="label">已收</span><span>{formatMoney(item.paidAmount)}</span></div>
            <div className="mobile-card__row"><span className="label">未收</span><span style={{ color: item.unpaidAmount > 0 ? '#f5222d' : '#52c41a' }}>{formatMoney(item.unpaidAmount)}</span></div>
            <div className="mobile-card__row"><span className="label">开票</span><span>{item.invoiceStatus || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">经办销售</span><span>{item.salesName || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">回款计划</span><span>{item.paymentPlanDate || '-'}</span></div>
            <Progress percent={item.paymentProgress || 0} size="small" style={{ marginTop: 6 }} />
            {canPay && item.paymentStatus !== '已回款' && (
              <Button type="primary" size="small" block style={{ marginTop: 8 }} onClick={() => setPayTarget(item)}>
                录入回款
              </Button>
            )}
          </Card>
        ))}
      </Spin>
      <PaymentModal
        open={!!payTarget}
        record={payTarget}
        onCancel={() => setPayTarget(null)}
        onSubmit={handlePay}
      />
    </div>
  )
}
