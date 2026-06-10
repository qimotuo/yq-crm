import { useEffect, useState } from 'react'
import { Table, Input, Button, Space, Tag, Progress, Modal, Descriptions, Form, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { getIntegratedList, getFinanceList, recordPayment, sendBill } from '../api'
import { PaymentStatusTag } from '../components/StatusTag'
import { formatMoney } from '../utils/helpers'
import PaymentModal from '../components/PaymentModal'
import { Permission } from '../components/RequireAuth'

export default function IntegratedQuery() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')
  const [assetModal, setAssetModal] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [billModal, setBillModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const [financeRecord, setFinanceRecord] = useState(null)
  const [billForm] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getIntegratedList(keyword ? { keyword } : {})
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openPayment = async (record) => {
    const res = await getFinanceList({ orderNo: record.orderNo })
    if (!res.list.length) return message.warning('未找到财务账单')
    setFinanceRecord(res.list[0])
    setPayModal(true)
  }

  const handlePay = async (values) => {
    await recordPayment({ id: financeRecord.id, ...values })
    message.success('回款录入成功')
    setPayModal(false)
    load()
  }

  const handleSendBill = async () => {
    const values = await billForm.validateFields()
    await sendBill({ ...values, id: financeRecord.id, customerName: financeRecord.customerName })
    message.success('对账单已发送')
    setBillModal(false)
  }

  const contractColor = { '正常': 'success', '即将到期': 'warning' }

  const columns = [
    { title: '门店', dataIndex: 'storeName', width: 110, fixed: 'left' },
    { title: '客户', dataIndex: 'customerName', width: 150 },
    { title: '经办销售', dataIndex: 'salesName', width: 80 },
    { title: '联系状态', dataIndex: 'contactStatus', width: 90, render: (s) => <Tag color={s === '正常' ? 'success' : 'error'}>{s}</Tag> },
    { title: '账单月', dataIndex: 'billMonth', width: 80 },
    { title: '应收', dataIndex: 'totalAmount', width: 90, render: formatMoney },
    { title: '已收', dataIndex: 'paidAmount', width: 90, render: formatMoney },
    { title: '未收', dataIndex: 'unpaidAmount', width: 90, render: (v) => <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>{formatMoney(v)}</span> },
    { title: '回款状态', dataIndex: 'paymentStatus', width: 90, render: (s) => <PaymentStatusTag status={s} /> },
    { title: '计划日', dataIndex: 'paymentPlanDate', width: 100 },
    { title: '合同状态', dataIndex: 'contractStatus', width: 100, render: (s) => <Tag color={contractColor[s]}>{s}</Tag> },
    { title: '开票', dataIndex: 'invoiceStatus', width: 80 },
    { title: '进度', width: 100, render: (_, r) => <Progress percent={Math.round((r.paidAmount / r.totalAmount) * 100) || 0} size="small" /> },
    { title: '设备', width: 100, render: (_, r) => r.deviceModel ? `${r.deviceSupplier}${r.deviceModel}` : '-' },
    { title: 'MAC', dataIndex: 'mac', width: 140, render: (v) => v || '-' },
    { title: 'IMEI', dataIndex: 'imei', width: 140, render: (v) => v || '-' },
    { title: '运营商', dataIndex: 'operator', width: 80, render: (v) => v || '-' },
    { title: 'ICCID', dataIndex: 'iccid', width: 150, render: (v) => v || '-' },
    { title: '工单号', dataIndex: 'orderNo', width: 150 },
    { title: '资产健康', dataIndex: 'assetHealth', width: 90, render: (s) => <Tag color={s === '离线预警' ? 'error' : 'success'}>{s}</Tag> },
    {
      title: '操作', width: 220, fixed: 'right',
      render: (_, r) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => { setCurrent(r); setAssetModal(true) }}>资产</Button>
          <Permission code="finance:send">
            <Button type="link" size="small" onClick={async () => {
              const res = await getFinanceList({ orderNo: r.orderNo })
              if (!res.list.length) return message.warning('未找到账单')
              setFinanceRecord(res.list[0])
              billForm.setFieldsValue({ email: '' })
              setBillModal(true)
            }}>对账单</Button>
          </Permission>
          <Permission code="finance:payment">
            <Button type="link" size="small" onClick={() => openPayment(r)}>录入</Button>
          </Permission>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>销售+财务+工单关联查询</h2>
        <p>跨模块统一视图，一表看清客户全貌</p>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索客户/工单/门店" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 260 }} allowClear />
        <Button type="primary" onClick={load}>查询</Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 2600 }} pagination={{ pageSize: 10 }} />

      <Modal title={`资产明细 — ${current?.customerName}`} open={assetModal} onCancel={() => setAssetModal(false)} footer={null} width={560}>
        {current && (
          <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="设备供应商">{current.deviceSupplier || '-'}</Descriptions.Item>
            <Descriptions.Item label="型号">{current.deviceModel || '-'}</Descriptions.Item>
            <Descriptions.Item label="MAC">{current.mac || '-'}</Descriptions.Item>
            <Descriptions.Item label="IMEI">{current.imei || '-'}</Descriptions.Item>
            <Descriptions.Item label="运营商">{current.operator || '-'}</Descriptions.Item>
            <Descriptions.Item label="ICCID">{current.iccid || '-'}</Descriptions.Item>
            <Descriptions.Item label="工单号">{current.orderNo}</Descriptions.Item>
            <Descriptions.Item label="资产健康"><Tag color={current.assetHealth === '离线预警' ? 'error' : 'success'}>{current.assetHealth}</Tag></Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <PaymentModal open={payModal} record={financeRecord} onCancel={() => setPayModal(false)} onSubmit={handlePay} />

      <Modal title="发送对账单" open={billModal} onOk={handleSendBill} onCancel={() => setBillModal(false)}>
        <p>客户：<strong>{financeRecord?.customerName}</strong></p>
        <Form form={billForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="email" label="客户邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="customer@example.com" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
