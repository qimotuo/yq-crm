import { useEffect, useState } from 'react'
import { Table, Select, Button, Space, Progress, Tag, Modal, Form, Input, InputNumber, Descriptions, message, Timeline, Upload } from 'antd'
import { PlusOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { getFinanceList, createFinance, importFinance, recordPayment, sendBill, getPaymentRecords } from '../api'
import { PaymentStatusTag } from '../components/StatusTag'
import { formatMoney } from '../utils/helpers'
import ExportButton from '../components/ExportButton'
import PaymentModal from '../components/PaymentModal'
import { Permission } from '../components/RequireAuth'
import { openCreateForm, closeFormModal } from '../utils/formModal'
import { downloadCsvTemplate, parseCsvFile } from '../utils/csvImport'
import { ListToolbar, QueryButton, ResetButton, FilterSelect } from '../components/ListToolbar'

const FINANCE_TEMPLATE = {
  filename: '财务账单导入模板.csv',
  headers: ['店名', '客户名称', '工单号', '合作套餐', '账单月份', '合同周期', '应收总额', '已收金额', '回款计划日', '经办销售', '开票状态'],
  keys: ['storeName', 'customerName', 'orderNo', 'package', 'billMonth', 'contractPeriod', 'totalAmount', 'paidAmount', 'paymentPlanDate', 'salesName', 'invoiceStatus'],
  sample: ['红渡小香', '智慧社区A区物业', 'GD-20261025-088', '企业旗舰版(5账号)', '2026-11', '2026-11-02 至 2027-11-01', '12000', '0', '2026-11-05', '张三', '待开票'],
  required: ['storeName', 'customerName', 'orderNo', 'totalAmount'],
}

const INVOICE_STATUSES = ['增值税专用发票', '增值税普通发票', '不开发票', '待开票', '已开票']

export default function FinanceList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [detailModal, setDetailModal] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [billModal, setBillModal] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const [paymentRecords, setPaymentRecords] = useState([])
  const [billForm] = Form.useForm()
  const [form] = Form.useForm()

  const load = async (status = statusFilter) => {
    setLoading(true)
    try {
      const params = {}
      if (status) params.paymentStatus = status
      const res = await getFinanceList(params)
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  const onStatusChange = (v) => {
    const status = v || ''
    setStatusFilter(status)
    load(status)
  }

  const handleReset = () => {
    setStatusFilter('')
    load('')
  }

  useEffect(() => { load() }, [])

  const openDetail = async (record) => {
    setCurrent(record)
    const res = await getPaymentRecords(record.id)
    setPaymentRecords(res.list)
    setDetailModal(true)
  }

  const handlePay = async (values) => {
    await recordPayment({ id: current.id, ...values })
    message.success(values.verified ? '回款录入并核销成功' : '回款录入成功')
    setPayModal(false)
    load()
  }

  const handleSendBill = async () => {
    const values = await billForm.validateFields()
    await sendBill({ ...values, id: current.id, customerName: current.customerName })
    message.success('对账单已发送')
    setBillModal(false)
  }

  const openCreate = () => {
    openCreateForm(form, {
      storeName: '', customerName: '', orderNo: '', package: '',
      billMonth: new Date().toISOString().slice(0, 7),
      contractPeriod: '', totalAmount: 0, paidAmount: 0,
      paymentPlanDate: '', salesName: '', invoiceStatus: '待开票',
    })
    setCreateModal(true)
  }

  const handleCreate = async () => {
    const values = await form.validateFields()
    await createFinance(values)
    message.success('账单已新增')
    closeFormModal(form, setCreateModal)
    load()
  }

  const handleImport = async (file) => {
    try {
      const text = await file.text()
      const rows = parseCsvFile(text, FINANCE_TEMPLATE).map((row) => ({
        ...row,
        totalAmount: Number(row.totalAmount) || 0,
        paidAmount: Number(row.paidAmount) || 0,
      }))
      const res = await importFinance(rows)
      message.success(`成功导入 ${res.count} 条账单`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const invoiceColor = { '已开票': 'success', '待开票': 'warning', '不开票': 'default' }
  const contractColor = { '正常': 'success', '即将到期': 'warning' }

  const columns = [
    { title: '客户门店', dataIndex: 'storeName', width: 120, fixed: 'left' },
    { title: '客户名称', dataIndex: 'customerName', width: 160 },
    { title: '工单号', dataIndex: 'orderNo', width: 160 },
    { title: '合作套餐', dataIndex: 'package', width: 160 },
    { title: '账单月份', dataIndex: 'billMonth', width: 90 },
    { title: '合同周期', dataIndex: 'contractPeriod', width: 180 },
    { title: '合同状态', dataIndex: 'contractStatus', width: 100, render: (s) => <Tag color={contractColor[s]}>{s === '即将到期' ? '⚠️即将到期' : s}</Tag> },
    { title: '应收总额', dataIndex: 'totalAmount', width: 100, render: formatMoney },
    { title: '已收金额', dataIndex: 'paidAmount', width: 100, render: formatMoney },
    { title: '未收余额', dataIndex: 'unpaidAmount', width: 100, render: (v) => <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>{formatMoney(v)}</span> },
    { title: '回款状态', dataIndex: 'paymentStatus', width: 90, render: (s) => <PaymentStatusTag status={s} /> },
    { title: '回款进度', dataIndex: 'paymentProgress', width: 120, render: (v) => <Progress percent={v} size="small" /> },
    { title: '开票状态', dataIndex: 'invoiceStatus', width: 90, render: (s) => <Tag color={invoiceColor[s]}>{s}</Tag> },
    { title: '经办销售', dataIndex: 'salesName', width: 80 },
    { title: '回款计划日', dataIndex: 'paymentPlanDate', width: 110 },
    {
      title: '操作', width: 220, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openDetail(r)}>查看</Button>
          <Permission code="finance:payment">
            <Button type="link" size="small" onClick={() => { setCurrent(r); setPayModal(true) }}>录入</Button>
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
      <ListToolbar
        filters={(
          <>
            <FilterSelect placeholder="回款状态" value={statusFilter || undefined} onChange={onStatusChange}
              options={['已回款', '部分回款', '已逾期', '未回款'].map((s) => ({ value: s, label: s }))} />
            <QueryButton loading={loading} onClick={() => load()} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <Space>
            <Permission code="finance:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增账单</Button>
            </Permission>
            <Permission code="finance:import">
              <Button icon={<DownloadOutlined />} onClick={() => downloadCsvTemplate(FINANCE_TEMPLATE)}>下载模板</Button>
              <Upload accept=".csv" showUploadList={false} beforeUpload={handleImport}>
                <Button icon={<UploadOutlined />}>批量导入</Button>
              </Upload>
            </Permission>
            <Permission code="finance:export">
              <ExportButton filename="finance.csv" label="导出账单" />
            </Permission>
          </Space>
        )}
      />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 2200 }} pagination={{ pageSize: 10 }} />

      <Modal title="新增财务账单" open={createModal} onOk={handleCreate} onCancel={() => closeFormModal(form, setCreateModal)} width={640} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="storeName" label="客户门店" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="orderNo" label="工单号" rules={[{ required: true }]}><Input placeholder="GD-20261025-088" /></Form.Item>
          <Form.Item name="package" label="合作套餐"><Input /></Form.Item>
          <Form.Item name="billMonth" label="账单月份"><Input placeholder="2026-11" /></Form.Item>
          <Form.Item name="contractPeriod" label="合同周期"><Input placeholder="2026-11-02 至 2027-11-01" /></Form.Item>
          <Form.Item name="totalAmount" label="应收总额" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="paidAmount" label="已收金额"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="paymentPlanDate" label="回款计划日"><Input placeholder="2026-11-05" /></Form.Item>
          <Form.Item name="salesName" label="经办销售"><Input /></Form.Item>
          <Form.Item name="invoiceStatus" label="开票状态">
            <Select options={INVOICE_STATUSES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="账单详情" open={detailModal} onCancel={() => setDetailModal(false)} footer={null} width={640}>
        {current && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="客户">{current.customerName}</Descriptions.Item>
              <Descriptions.Item label="门店">{current.storeName}</Descriptions.Item>
              <Descriptions.Item label="工单号">{current.orderNo}</Descriptions.Item>
              <Descriptions.Item label="套餐">{current.package}</Descriptions.Item>
              <Descriptions.Item label="账单月份">{current.billMonth}</Descriptions.Item>
              <Descriptions.Item label="经办销售">{current.salesName}</Descriptions.Item>
              <Descriptions.Item label="合同周期" span={2}>{current.contractPeriod}</Descriptions.Item>
              <Descriptions.Item label="应收">{formatMoney(current.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="已收">{formatMoney(current.paidAmount)}</Descriptions.Item>
              <Descriptions.Item label="回款状态"><PaymentStatusTag status={current.paymentStatus} /></Descriptions.Item>
              <Descriptions.Item label="开票">{current.invoiceStatus}</Descriptions.Item>
              <Descriptions.Item label="最近回款">{current.lastPaymentTime || '-'}</Descriptions.Item>
            </Descriptions>
            {paymentRecords.length > 0 && (
              <>
                <h4 style={{ marginTop: 20 }}>回款记录</h4>
                <Timeline items={paymentRecords.map((p) => ({
                  children: `${p.time} · ¥${p.amount} · ${p.voucher || '无凭证'} · ${p.verified ? '已核销' : '待核销'}`,
                }))} />
              </>
            )}
          </>
        )}
      </Modal>

      <PaymentModal open={payModal} record={current} onCancel={() => setPayModal(false)} onSubmit={handlePay} />

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
