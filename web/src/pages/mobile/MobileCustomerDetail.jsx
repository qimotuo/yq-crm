import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Button, Spin, Select, Input, message } from 'antd'
import { PhoneOutlined } from '@ant-design/icons'
import { getCustomer, getFinanceByOrder, getContractByOrder, updateCustomer, returnCustomer } from '../../api'
import { getInstallationDetail } from '../../api/workOrder'
import { Permission } from '../../components/RequireAuth'
import { hasOperation, canTrace, canViewFinance, canViewContract } from '../../utils/mobileAuth'
import { h5Path } from '../../utils/basePath'

function orderToCustomer(order) {
  return {
    id: order.customerId || 0,
    workOrderId: order.id,
    customerName: order.customerName,
    storeName: order.storeName,
    contact: order.contact,
    phone: order.contactPhone,
    address: order.address,
    salesName: order.salesName,
    orderNo: order.orderNo,
    installDate: order.installDate,
    deviceModel: order.deviceModel,
    mac: order.mac,
    imei: order.imei,
    iccid: order.iccid,
    backupIccid: order.backupIccid,
    operator: order.operator,
    lastFollowTime: order.lastFollowTime,
    contactStatus: order.contactStatus,
    wechatId: order.wechatId,
    deviceSupplier: order.deviceSupplier,
    simSupplier: order.simSupplier,
    price: order.price,
    installRemark: order.installRemark,
    claimTime: order.claimTime,
    contractPeriod: order.contractPeriod,
    invoiceType: order.invoiceType,
  }
}

const CONTACT_STATUSES = ['正常', '中断合作', '待跟进']

export default function MobileCustomerDetail() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const id = Number(params.get('id') || 0)
  const workOrderId = Number(params.get('workOrderId') || 0)
  const [customer, setCustomer] = useState(null)
  const [finance, setFinance] = useState(null)
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [wechatId, setWechatId] = useState('')
  const [showWechat, setShowWechat] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        let c = null
        if (workOrderId) c = orderToCustomer(await getInstallationDetail(workOrderId))
        else if (id) c = await getCustomer(id)
        setCustomer(c)
        setWechatId(c?.wechatId || '')
        setFinance(null)
        setContract(null)
        if (c?.orderNo) {
          if (canViewFinance()) {
            try {
              const fin = await getFinanceByOrder(c.orderNo)
              setFinance(fin.list?.[0] || null)
            } catch { /* ignore */ }
          }
          if (canViewContract()) {
            try {
              const con = await getContractByOrder(c.orderNo)
              setContract(con.list?.[0] || null)
            } catch { /* ignore */ }
          }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [id, workOrderId])

  if (loading) return <Spin style={{ display: 'block', margin: '48px auto' }} />
  if (!customer) return <div className="mobile-empty">客户不存在</div>

  const goFollowUps = () => {
    if (!customer.id) return
    navigate(`${h5Path('follow-ups')}?customerId=${customer.id}&customerName=${encodeURIComponent(customer.customerName)}`)
  }

  const goTrace = () => {
    if (!customer.orderNo) return
    navigate(`${h5Path('trace')}?type=orderNo&value=${encodeURIComponent(customer.orderNo)}`)
  }

  const goCreateOrder = () => {
    const q = new URLSearchParams({
      mode: 'create',
      storeName: customer.storeName || '',
      customerName: customer.customerName || '',
      address: customer.address || '',
      contact: customer.contact || '',
      contactPhone: customer.phone || '',
    })
    navigate(`${h5Path('orders/dispatch')}?${q}`)
  }

  return (
    <div className="mobile-form-stack">
      <Card className="mobile-card" size="small">
        <div className="mobile-card__title"><strong>{customer.customerName}</strong></div>
        {customer.storeName && <div className="mobile-card__row"><span className="label">店名</span><span>{customer.storeName}</span></div>}
        <div className="mobile-card__row"><span className="label">联系人</span><span>{customer.contact || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">电话</span><span>{customer.phone || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">销售</span><span>{customer.salesName || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">工单号</span><span>{customer.orderNo || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">地址</span><span>{customer.address || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">领取时间</span><span>{customer.claimTime || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">安装日期</span><span>{customer.installDate || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">设备</span><span>{[customer.deviceSupplier, customer.deviceModel].filter(Boolean).join(' ') || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">MAC</span><span>{customer.mac || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">IMEI</span><span>{customer.imei || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">运营商</span><span>{customer.operator || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">卡供应商</span><span>{customer.simSupplier || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">主卡</span><span>{customer.iccid || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">备用卡</span><span>{customer.backupIccid || customer.iccid2 || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">价格</span><span>{customer.price || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">合同周期</span><span>{customer.contractPeriod || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">开票类型</span><span>{customer.invoiceType || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">微信</span><span>{customer.wechatId || '-'}</span></div>
        <div className="mobile-card__row"><span className="label">最近跟进</span><span>{customer.lastFollowTime || '-'}</span></div>
        {customer.id > 0 && (
          <div className="mobile-card__row">
            <span className="label">联系状态</span>
            <Select size="small" value={customer.contactStatus || '正常'} style={{ width: 120 }}
              options={CONTACT_STATUSES.map((v) => ({ value: v, label: v }))}
              onChange={async (v) => {
                await updateCustomer(customer.id, { contactStatus: v })
                setCustomer({ ...customer, contactStatus: v })
                message.success('状态已更新')
              }} />
          </div>
        )}
      </Card>

      {finance && (
        <Card className="mobile-card" size="small" title="财务（只读）">
          <div className="mobile-card__row"><span className="label">工单号</span><span>{finance.orderNo || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">套餐</span><span>{finance.package || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">账期</span><span>{finance.billMonth || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">合同周期</span><span>{finance.contractPeriod || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">合同状态</span><span>{finance.contractStatus || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">回款状态</span><span>{finance.paymentStatus}</span></div>
          <div className="mobile-card__row"><span className="label">应收</span><span>¥{finance.totalAmount}</span></div>
          <div className="mobile-card__row"><span className="label">已收</span><span>¥{finance.paidAmount}</span></div>
          <div className="mobile-card__row"><span className="label">未收</span><span>¥{finance.unpaidAmount}</span></div>
          <div className="mobile-card__row"><span className="label">开票</span><span>{finance.invoiceStatus || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">经办销售</span><span>{finance.salesName || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">回款计划</span><span>{finance.paymentPlanDate || '-'}</span></div>
        </Card>
      )}

      {contract && (
        <Card className="mobile-card" size="small" title="合同（只读）">
          <div className="mobile-card__row"><span className="label">合同号</span><span>{contract.contractNo}</span></div>
          <div className="mobile-card__row"><span className="label">状态</span><span>{contract.status}</span></div>
          <div className="mobile-card__row"><span className="label">金额</span><span>¥{contract.amount}</span></div>
          <div className="mobile-card__row"><span className="label">签署人</span><span>{contract.signerName || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">手机号</span><span>{contract.signerPhone || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">身份证</span><span>{contract.signerIdNo || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">签署日期</span><span>{contract.signDate || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">门店</span><span>{contract.storeName || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">套餐</span><span>{contract.package || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">周期</span><span>{contract.startDate || '-'} 至 {contract.endDate || '-'}</span></div>
          <div className="mobile-card__row"><span className="label">城市代码</span><span>{contract.cityCode || '-'}</span></div>
        </Card>
      )}

      <div className="mobile-form-stack">
        <Permission code="my-customer:call">
          {customer.phone && (
            <Button type="primary" block icon={<PhoneOutlined />} href={`tel:${customer.phone}`}>一键外呼</Button>
          )}
        </Permission>
        {customer.id > 0 && hasOperation('my-customer:follow') && (
          <Button block onClick={goFollowUps}>跟进记录</Button>
        )}
        {customer.id > 0 && (
          <Button block onClick={() => setShowWechat(!showWechat)}>{showWechat ? '取消微信' : '记录微信'}</Button>
        )}
        {showWechat && customer.id > 0 && (
          <>
            <Input placeholder="微信号" value={wechatId} onChange={(e) => setWechatId(e.target.value)} />
            <Button block type="primary" onClick={async () => {
              if (!wechatId.trim()) return message.warning('请填写微信号')
              await updateCustomer(customer.id, { wechatId: wechatId.trim() })
              setCustomer({ ...customer, wechatId: wechatId.trim() })
              setShowWechat(false)
              message.success('微信已保存')
            }}>保存微信</Button>
          </>
        )}
        {hasOperation('workorder:create') && (
          <Button block onClick={goCreateOrder}>发安装单</Button>
        )}
        {customer.id > 0 && hasOperation('my-customer:return') && (
          <Button danger block onClick={async () => {
            await returnCustomer({ id: customer.id, customerName: customer.customerName, storeName: customer.storeName, reason: '手动退回' })
            message.success('已退回公海')
            navigate(-1)
          }}>退回公海</Button>
        )}
        {canTrace() && customer.orderNo && (
          <Button block onClick={goTrace}>全链路追溯</Button>
        )}
      </div>
    </div>
  )
}
