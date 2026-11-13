import { useEffect, useState } from 'react'
import { Table, Select, Button, Space, Progress, Tag, Modal, Form, Input, InputNumber, Descriptions, message, Timeline, Upload, Image, DatePicker } from 'antd'
import { PlusOutlined, UploadOutlined, DownloadOutlined, EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getFinanceList, createFinance, updateFinance, importFinance, recordPayment, sendBill, getPaymentRecords } from '../api'
import { fileUrl } from '../api/upload'
import { PaymentStatusTag } from '../components/StatusTag'
import { formatMoney } from '../utils/helpers'
import ExportButton from '../components/ExportButton'
import PaymentModal from '../components/PaymentModal'
import { Permission } from '../components/RequireAuth'
import { openCreateForm, closeFormModal } from '../utils/formModal'
import { downloadCsvTemplate, parseImportFile, IMPORT_ACCEPT } from '../utils/csvImport'
import { FilterInput, FilterField, FilterSelect, QueryButton, ResetButton, applyFilterPatch } from '../components/ListToolbar'
import FormColumnLayout, { modalFormWidth } from '../components/FormColumnLayout'
import ChangeLogButton from '../components/ChangeLogButton'
import { useTablePagination } from '../hooks/useTablePagination'
import { canFilterBySales } from '../rbac/utils'

const EMPTY_FILTERS = {
  keyword: '',
  paymentStatus: '',
  invoiceStatus: '',
  contractStatus: '',
  salesName: '',
  billMonth: null,
  contactStatus: '',
  assetHealth: '',
}

const PAYMENT_STATUSES = ['已回款', '部分回款', '已逾期', '未回款']
const CONTRACT_STATUSES = ['正常', '30天后到期', '10天后到期', '3天后到期', '已逾期']
const CONTACT_STATUSES = ['正常', '中断合作', '待跟进']
const ASSET_HEALTH = ['正常', '离线预警']

function buildQueryParams(query) {
  const params = {}
  Object.entries(query).forEach(([key, value]) => {
    if (!value) return
    if (key === 'billMonth') {
      params.billMonth = dayjs.isDayjs(value) ? value.format('YYYY-MM') : value
      return
    }
    params[key] = value
  })
  return params
}

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
  const { pagination } = useTablePagination(10, data.length)
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [query, setQuery] = useState({ ...EMPTY_FILTERS })
  const [detailModal, setDetailModal] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [billModal, setBillModal] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [current, setCurrent] = useState(null)
  const [paymentRecords, setPaymentRecords] = useState([])
  const [billForm] = Form.useForm()
  const [form] = Form.useForm()
  const filterBySales = canFilterBySales()

  const load = async (params = query) => {
    setLoading(true)
    try {
      const res = await getFinanceList(buildQueryParams(params))
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [query])

  const handleSearch = () => setQuery({ ...filters })

  const handleReset = () => {
    setFilters({ ...EMPTY_FILTERS })
    setQuery({ ...EMPTY_FILTERS })
  }

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))
  const onSelectFilter = (key) => (v) => applyFilterPatch({ [key]: v || '' }, setFilters, setQuery)

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

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue({
      storeName: record.storeName,
      customerName: record.customerName,
      orderNo: record.orderNo,
      package: record.package,
      billMonth: record.billMonth,
      contractPeriod: record.contractPeriod,
      totalAmount: record.totalAmount,
      paidAmount: record.paidAmount,
      paymentPlanDate: record.paymentPlanDate,
      salesName: record.salesName,
      invoiceStatus: record.invoiceStatus,
    })
    setCreateModal(true)
  }

  const openCreate = () => {
    setEditing(null)
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
    if (editing) {
      await updateFinance({ id: editing.id, ...values })
      message.success('账单已更新')
    } else {
      await createFinance(values)
      message.success('账单已新增')
    }
    setEditing(null)
    closeFormModal(form, setCreateModal)
    load()
  }

  const handleImport = async (file) => {
    try {
      const rows = (await parseImportFile(file, FINANCE_TEMPLATE)).map((row) => ({
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
  const contractColor = { 正常: 'success', 一个月到期: 'gold', '30天后到期': 'gold', '10天到期': 'orange', '10天后到期': 'orange', 三天到期: 'red', '3天后到期': 'red', 已到期: 'error', 已逾期: 'error', 即将到期: 'warning' }

  const text = (v) => v || '-'

  const columns = [
    { title: '店名', dataIndex: 'storeName', width: 130, fixed: 'left' },
    { title: '公司名称', dataIndex: 'customerName', width: 160 },
    { title: '联系人', dataIndex: 'contact', width: 90, render: text },
    { title: '手机号', dataIndex: 'phone', width: 120, render: text },
    { title: '工单号', dataIndex: 'orderNo', width: 140 },
    { title: '合同周期', dataIndex: 'contractPeriod', width: 180, render: text },
    { title: '账单月', dataIndex: 'billMonth', width: 90, render: text },
    { title: '售价', dataIndex: 'price', width: 80, render: text },
    { title: '回款状态', dataIndex: 'paymentStatus', width: 90, render: (s) => <PaymentStatusTag status={s} /> },
    { title: '开票', dataIndex: 'invoiceStatus', width: 110, render: (s) => s ? <Tag color={invoiceColor[s]}>{s}</Tag> : '-' },
    { title: '合同状态', dataIndex: 'contractStatus', width: 120, render: (s) => <Tag color={contractColor[s]}>{s || '-'}</Tag> },
    { title: '联系状态', dataIndex: 'contactStatus', width: 90, render: (s) => <Tag color={s === '正常' ? 'success' : 'error'}>{s || '-'}</Tag> },
    { title: '资产健康', dataIndex: 'assetHealth', width: 90, render: (s) => <Tag color={s === '离线预警' ? 'error' : 'success'}>{s || '-'}</Tag> },
    { title: '应收', dataIndex: 'totalAmount', width: 90, render: formatMoney },
    { title: '已收', dataIndex: 'paidAmount', width: 90, render: formatMoney },
    { title: '未收', dataIndex: 'unpaidAmount', width: 90, render: (v) => <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>{formatMoney(v)}</span> },
    { title: '计划日', dataIndex: 'paymentPlanDate', width: 110, render: text },
    { title: '进度', dataIndex: 'paymentProgress', width: 100, render: (v) => <Progress percent={v || 0} size="small" /> },
    { title: '经办销售', dataIndex: 'salesName', width: 90 },
    { title: '合作套餐', dataIndex: 'package', width: 140, render: text },
    {
      title: '操作', width: 300, fixed: 'right',
      render: (_, r) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => openDetail(r)}>查看</Button>
          <Permission code="finance:edit">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          </Permission>
          <ChangeLogButton module="财务" targetId={r.id} />
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
      <div className="order-query-bar finance-query-bar">
        <div className="order-query-bar__row">
          <FilterInput
            placeholder="客户/店名/工单号/联系人/手机号/套餐"
            value={filters.keyword}
            onChange={(e) => setFilter('keyword', e.target.value)}
            onPressEnter={handleSearch}
          />
          <FilterSelect
            placeholder="回款状态"
            value={filters.paymentStatus || undefined}
            onChange={onSelectFilter('paymentStatus')}
            options={PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <FilterSelect
            className="finance-filter-invoice"
            placeholder="开票状态"
            value={filters.invoiceStatus || undefined}
            onChange={onSelectFilter('invoiceStatus')}
            options={INVOICE_STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <FilterSelect
            wide
            placeholder="合同状态"
            value={filters.contractStatus || undefined}
            onChange={onSelectFilter('contractStatus')}
            options={CONTRACT_STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <div className="order-query-bar__actions">
            <QueryButton loading={loading} onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
          </div>
        </div>
        <div className="order-query-bar__row">
          {filterBySales && (
            <FilterField
              placeholder="负责销售"
              value={filters.salesName}
              onChange={(e) => setFilter('salesName', e.target.value)}
              onPressEnter={handleSearch}
            />
          )}
          <DatePicker
            picker="month"
            className="finance-filter-month"
            placeholder="账单月份"
            value={filters.billMonth}
            onChange={(v) => applyFilterPatch({ billMonth: v }, setFilters, setQuery)}
            allowClear
          />
          <FilterSelect
            placeholder="联系状态"
            value={filters.contactStatus || undefined}
            onChange={onSelectFilter('contactStatus')}
            options={CONTACT_STATUSES.map((s) => ({ value: s, label: s }))}
          />
          <FilterSelect
            placeholder="资产健康"
            value={filters.assetHealth || undefined}
            onChange={onSelectFilter('assetHealth')}
            options={ASSET_HEALTH.map((s) => ({ value: s, label: s }))}
          />
          <div className="order-query-bar__actions">
            <Permission code="finance:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增账单</Button>
            </Permission>
            <Permission code="finance:import">
              <Button icon={<DownloadOutlined />} onClick={() => downloadCsvTemplate(FINANCE_TEMPLATE)}>下载模板</Button>
              <Upload accept={IMPORT_ACCEPT} showUploadList={false} beforeUpload={handleImport}>
                <Button icon={<UploadOutlined />}>批量导入</Button>
              </Upload>
            </Permission>
            <Permission code="finance:export">
              <ExportButton filename="finance.csv" label="导出账单" data={data} columns={columns} />
            </Permission>
          </div>
        </div>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 2800 }} pagination={{ ...pagination, showTotal: (t) => `共 ${t} 条` }} />

      <Modal title={editing ? '编辑财务账单' : '新增财务账单'} open={createModal} onOk={handleCreate} onCancel={() => { setEditing(null); closeFormModal(form, setCreateModal) }} width={modalFormWidth(11)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <FormColumnLayout>
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
          </FormColumnLayout>
        </Form>
      </Modal>

      <Modal title="账单详情" open={detailModal} onCancel={() => setDetailModal(false)} footer={null} width={640}>
        {current && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="公司名称">{current.customerName}</Descriptions.Item>
              <Descriptions.Item label="店名">{current.storeName}</Descriptions.Item>
              <Descriptions.Item label="联系人">{current.contact || '-'}</Descriptions.Item>
              <Descriptions.Item label="手机号">{current.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="工单号">{current.orderNo}</Descriptions.Item>
              <Descriptions.Item label="售价">{current.price || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系状态">{current.contactStatus || '-'}</Descriptions.Item>
              <Descriptions.Item label="资产健康">{current.assetHealth || '-'}</Descriptions.Item>
              <Descriptions.Item label="套餐">{current.package}</Descriptions.Item>
              <Descriptions.Item label="账单月份">{current.billMonth}</Descriptions.Item>
              <Descriptions.Item label="经办销售">{current.salesName}</Descriptions.Item>
              <Descriptions.Item label="合同周期" span={2}>{current.contractPeriod}</Descriptions.Item>
              <Descriptions.Item label="应收">{formatMoney(current.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="已收">{formatMoney(current.paidAmount)}</Descriptions.Item>
              <Descriptions.Item label="未收">{formatMoney(current.unpaidAmount)}</Descriptions.Item>
              <Descriptions.Item label="计划日">{current.paymentPlanDate || '-'}</Descriptions.Item>
              <Descriptions.Item label="进度">{current.paymentProgress || 0}%</Descriptions.Item>
              <Descriptions.Item label="合同状态">{current.contractStatus || '-'}</Descriptions.Item>
              <Descriptions.Item label="回款状态"><PaymentStatusTag status={current.paymentStatus} /></Descriptions.Item>
              <Descriptions.Item label="开票">{current.invoiceStatus}</Descriptions.Item>
              <Descriptions.Item label="最近回款">{current.lastPaymentTime || '-'}</Descriptions.Item>
            </Descriptions>
            {paymentRecords.length > 0 && (
              <>
                <h4 style={{ marginTop: 20 }}>回款记录</h4>
                <Timeline items={paymentRecords.map((p) => ({
                  children: (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>{p.time} · ¥{p.amount} · {p.verified ? '已核销' : '待核销'}</span>
                      {p.voucher ? (
                        /\.pdf$/i.test(p.voucher)
                          ? <a href={fileUrl(p.voucher)} target="_blank" rel="noreferrer">查看凭证</a>
                          : <Image width={40} src={fileUrl(p.voucher)} />
                      ) : <span>无凭证</span>}
                    </span>
                  ),
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
