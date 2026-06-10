import { useEffect, useState } from 'react'
import { Table, Select, Button, Space, Progress, Tag, Modal, Form, Input, InputNumber, Descriptions, message } from 'antd'
import { getFinanceList, recordPayment, sendBill } from '../api'
import { PaymentStatusTag } from '../components/StatusTag'
import { formatMoney } from '../utils/helpers'
import ExportButton from '../components/ExportButton'
import { Permission } from '../components/RequireAuth'

export default function FinanceList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [detailModal, setDetailModal] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [billModal, setBillModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form] = Form.useForm()
  const [billForm] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.paymentStatus = statusFilter
      const res = await getFinanceList(params)
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openPay = (record) => {
    setCurrent(record)
    form.setFieldsValue({ paidAmount: record.paidAmount })
    setPayModal(true)
  }

  const handlePay = async () => {
    const values = await form.validateFields()
    await recordPayment({ id: current.id, paidAmount: values.paidAmount })
    message.success('回款录入成功')
    setPayModal(false)
    load()
  }

  const handleSendBill = async () => {
    const values = await billForm.validateFields()
    await sendBill({ ...values, id: current.id, customerName: current.customerName })
    message.success('对账单已发送')
    setBillModal(false)
  }

  const invoiceColor = { '已开票': 'success', '待开票': 'warning', '不开票': 'default' }

  const columns = [
    { title: '客户门店', dataIndex: 'storeName', width: 120, fixed: 'left' },
    { title: '客户名称', dataIndex: 'customerName', width: 160 },
    { title: '工单号', dataIndex: 'orderNo', width: 160 },
    { title: '合作套餐', dataIndex: 'package', width: 160 },
    { title: '应收总额', dataIndex: 'totalAmount', width: 100, render: formatMoney },
    { title: '已收金额', dataIndex: 'paidAmount', width: 100, render: formatMoney },
    { title: '未收余额', dataIndex: 'unpaidAmount', width: 100, render: (v) => <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>{formatMoney(v)}</span> },
    { title: '回款状态', dataIndex: 'paymentStatus', width: 90, render: (s) => <PaymentStatusTag status={s} /> },
    { title: '回款进度', dataIndex: 'paymentProgress', width: 120, render: (v) => <Progress percent={v} size="small" /> },
    { title: '开票状态', dataIndex: 'invoiceStatus', width: 90, render: (s) => <Tag color={invoiceColor[s]}>{s === '已开票' ? '🧾已开票' : s === '待开票' ? '⏳待开票' : '❌不开票'}</Tag> },
    { title: '回款计划日', dataIndex: 'paymentPlanDate', width: 110 },
    {
      title: '操作', width: 220, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => { setCurrent(r); setDetailModal(true) }}>查看</Button>
          <Permission code="finance:payment">
            <Button type="link" size="small" onClick={() => openPay(r)}>录入</Button>
          </Permission>
          <Permission code="finance:send">
            <Button type="link" size="small" onClick={() => { setCurrent(r); billForm.setFieldsValue({ email: '' }); setBillModal(true) }}>发送</Button>
          </Permission>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>财务板块</h2>
        <p>应收/已收/未收管理、回款录入与核销</p>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <Select placeholder="回款状态" value={statusFilter || undefined} onChange={setStatusFilter} allowClear style={{ width: 130 }}
          options={['已回款', '部分回款', '已逾期', '未回款'].map((s) => ({ value: s, label: s }))} />
        <Button type="primary" onClick={load}>查询</Button>
        <Permission code="finance:export">
          <ExportButton filename="finance.csv" label="导出账单" />
        </Permission>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1600 }} pagination={{ pageSize: 10 }} />

      <Modal title="账单详情" open={detailModal} onCancel={() => setDetailModal(false)} footer={null} width={560}>
        {current && (
          <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="客户">{current.customerName}</Descriptions.Item>
            <Descriptions.Item label="门店">{current.storeName}</Descriptions.Item>
            <Descriptions.Item label="工单号">{current.orderNo}</Descriptions.Item>
            <Descriptions.Item label="套餐">{current.package}</Descriptions.Item>
            <Descriptions.Item label="合同周期" span={2}>{current.contractPeriod}</Descriptions.Item>
            <Descriptions.Item label="应收">{formatMoney(current.totalAmount)}</Descriptions.Item>
            <Descriptions.Item label="已收">{formatMoney(current.paidAmount)}</Descriptions.Item>
            <Descriptions.Item label="回款状态"><PaymentStatusTag status={current.paymentStatus} /></Descriptions.Item>
            <Descriptions.Item label="开票">{current.invoiceStatus}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal title="录入回款" open={payModal} onOk={handlePay} onCancel={() => setPayModal(false)}>
        <p>客户：<strong>{current?.customerName}</strong> · 应收 {formatMoney(current?.totalAmount)}</p>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="paidAmount" label="已收金额" rules={[{ required: true }]}>
            <InputNumber min={0} max={current?.totalAmount} style={{ width: '100%' }} addonBefore="¥" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="发送对账单" open={billModal} onOk={handleSendBill} onCancel={() => setBillModal(false)}>
        <p>客户：<strong>{current?.customerName}</strong> · 未收 {formatMoney(current?.unpaidAmount)}</p>
        <Form form={billForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="email" label="客户邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="customer@example.com" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
