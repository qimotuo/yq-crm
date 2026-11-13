import { useEffect, useState } from 'react'
import { Table, Input, Button, Space, Tag, Modal, Descriptions, Form, Select, message, Popconfirm, Upload, Image } from 'antd'
import { EyeOutlined, DollarOutlined, PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, importCustomers, getFinanceList, getPaymentRecords, recordPayment, getSalesOptions, transferCustomer } from '../api'
import { fileUrl, uploadFile } from '../api/upload'
import { formatMoney } from '../utils/helpers'
import PaymentModal from '../components/PaymentModal'
import CustomerAiSummary from '../components/CustomerAiSummary'
import { Permission } from '../components/RequireAuth'
import { useAgentContext } from '../context/AgentContext'
import { openCreateForm, closeFormModal } from '../utils/formModal'
import { ListToolbar, FilterInput, FilterField, FilterSelect, QueryButton, ResetButton, applyFilterPatch } from '../components/ListToolbar'
import { downloadCsvTemplate, parseImportFile, IMPORT_ACCEPT } from '../utils/csvImport'
import FormColumnLayout from '../components/FormColumnLayout'
import ChangeLogButton from '../components/ChangeLogButton'
import ExportButton from '../components/ExportButton'
import { useTablePagination } from '../hooks/useTablePagination'
import { useAuth } from '../hooks/useAuth'
import { canFilterBySales, canManageCustomerOwner } from '../rbac/utils'
import OwnerReviewPanel from '../components/OwnerReviewPanel'

function toIdFileList(url, name) {
  if (!url) return []
  return [{ uid: name, name, status: 'done', url: fileUrl(url), response: { url } }]
}

function pickUploadUrl(fileList) {
  const f = fileList?.[0]
  const url = f?.response?.url || f?.url || ''
  if (!url) return ''
  return String(url).startsWith('http') ? String(url).replace(/^https?:\/\/[^/]+/, '') : url
}

const CUSTOMER_TEMPLATE = {
  filename: '合作客户导入模板.csv',
  headers: [
    '店名', '客户名称', '联系人', '手机号', '销售', '工单号', '安装日期',
    '设备供应商', '设备型号', 'MAC', 'IMEI', 'ICCID', 'ICCID2', '运营商', 'SIM供应商',
    '合同周期', '价格', '开票类型', '联系状态',
  ],
  keys: [
    'storeName', 'customerName', 'contact', 'phone', 'salesName', 'orderNo', 'installDate',
    'deviceSupplier', 'deviceModel', 'mac', 'imei', 'iccid', 'iccid2', 'operator', 'simSupplier',
    'contractPeriod', 'price', 'invoiceType', 'contactStatus',
  ],
  sample: [
    '红渡小香', '智慧社区A区物业', '小王', '13800138000', '张三', 'GD-20261025-088', '2026-10-27',
    '鲲鹏', '618', 'AA:BB:CC:DD:EE:01', '865432041234567', '89860123456789012345', '', '移动', '光和',
    '2026-01-01 至 2027-01-01', '5760', '增值税专用发票', '正常',
  ],
  required: ['storeName', 'customerName', 'salesName'],
}

const EMPTY_FILTERS = {
  keyword: '',
  salesName: '',
  contactStatus: '',
  invoiceType: '',
  orderNo: '',
  mac: '',
  iccid: '',
  operator: '',
  installed: '',
  hasPayment: '',
}

const CONTACT_STATUSES = ['正常', '中断合作', '待跟进']
const INVOICE_TYPES = ['增值税专用发票', '增值税普通发票', '不开发票', '待开票']
const OPERATORS = ['移动', '电信', '联通']

function buildQueryParams(query) {
  const params = {}
  Object.entries(query).forEach(([key, value]) => {
    if (value) params[key] = value
  })
  return params
}

export default function CustomerList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const { pagination } = useTablePagination(10, data.length)
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [query, setQuery] = useState({ ...EMPTY_FILTERS })
  const [detailModal, setDetailModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [historyModal, setHistoryModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const [financeRecord, setFinanceRecord] = useState(null)
  const [paymentRecords, setPaymentRecords] = useState([])
  const [form] = Form.useForm()
  const [transferForm] = Form.useForm()
  const [salesOptions, setSalesOptions] = useState([])
  const [transferOpen, setTransferOpen] = useState(false)
  const { mergeAgentContext } = useAgentContext()
  const { user } = useAuth()
  const filterBySales = canFilterBySales()
  const manageOwner = canManageCustomerOwner()

  useEffect(() => {
    if (detailModal && current) {
      mergeAgentContext({
        page: '合作客户详情',
        customerId: current.id,
        customerName: current.customerName,
        orderNo: current.orderNo || '',
      })
    }
  }, [detailModal, current, mergeAgentContext])

  const load = async (params = query) => {
    setLoading(true)
    try {
      const res = await getCustomers(buildQueryParams(params))
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [query])

  useEffect(() => {
    if (!filterBySales) return
    getSalesOptions().then((res) => setSalesOptions(res.list || [])).catch(() => setSalesOptions([]))
  }, [filterBySales])

  const handleSearch = () => setQuery({ ...filters })

  const handleReset = () => {
    setFilters({ ...EMPTY_FILTERS })
    setQuery({ ...EMPTY_FILTERS })
  }

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const onSelectFilter = (key) => (v) => applyFilterPatch({ [key]: v || '' }, setFilters, setQuery)

  const defaultCustomerValues = () => ({
    storeName: '',
    customerName: '',
    contact: '',
    phone: '',
    salesName: '',
    contactStatus: '正常',
    invoiceType: '增值税普通发票',
    orderNo: '',
    installDate: '',
    deviceSupplier: '',
    deviceModel: '',
    mac: '',
    imei: '',
    iccid: '',
    iccid2: '',
    operator: '',
    simSupplier: '',
    contractPeriod: '',
    price: '',
  })

  const openEdit = (record) => {
    setCurrent(record)
    if (record?.id) {
      form.setFieldsValue({
        ...record,
        iccid2: record.iccid2 || record.backupIccid || '',
        idCardFront: toIdFileList(record.idCardFront, 'id-front'),
        idCardBack: toIdFileList(record.idCardBack, 'id-back'),
      })
    } else {
      openCreateForm(form, defaultCustomerValues())
    }
    setEditModal(true)
  }

  const closeEditModal = () => closeFormModal(form, setEditModal, () => setCurrent(null))

  const uploadIdCard = (category) => async ({ file, onSuccess, onError }) => {
    try {
      const data = await uploadFile(file, category)
      onSuccess({ ...data, url: fileUrl(data.url) })
      message.success('身份证已上传')
    } catch (e) {
      onError(e)
      message.error(e.message || '上传失败')
    }
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    const payload = {
      ...values,
      backupIccid: values.iccid2 || '',
      idCardFront: pickUploadUrl(values.idCardFront),
      idCardBack: pickUploadUrl(values.idCardBack),
    }
    if (!filterBySales) {
      delete payload.salesName
      if (!current?.id) payload.salesName = user.name
    }
    if (current?.id) {
      await updateCustomer(current.id, payload)
      message.success('客户已更新')
    } else {
      await createCustomer(payload)
      message.success('客户已新增')
    }
    closeEditModal()
    load()
  }

  const handleTransfer = async () => {
    const values = await transferForm.validateFields()
    await transferCustomer({ id: current.id, salesName: values.salesName, reason: values.reason || '' })
    message.success('客户已转交')
    setTransferOpen(false)
    load()
  }

  const handleDelete = async (id) => {
    await deleteCustomer(id)
    message.success('已删除')
    load()
  }

  const handleImport = async (file) => {
    try {
      const rows = await parseImportFile(file, CUSTOMER_TEMPLATE)
      const res = await importCustomers(rows)
      message.success(`成功导入 ${res.count} 条客户`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const openPayment = async (record) => {
    if (!record.financeId && !record.orderNo) {
      message.warning('该客户暂无关联财务账单')
      return
    }
    const params = record.financeId ? { id: record.financeId } : { orderNo: record.orderNo }
    const res = await getFinanceList(params)
    if (!res.list.length) {
      message.warning('未找到财务账单')
      return
    }
    setFinanceRecord(res.list[0])
    setPayModal(true)
  }

  const handlePay = async (values) => {
    await recordPayment({ id: financeRecord.id, ...values })
    message.success('回款录入成功')
    setPayModal(false)
    load()
  }

  const openHistory = async (record) => {
    if (!record.financeId) {
      message.info('暂无回款记录')
      return
    }
    const res = await getPaymentRecords(record.financeId)
    setPaymentRecords(res.list)
    setCurrent(record)
    setHistoryModal(true)
  }

  const columns = [
    { title: '店名', dataIndex: 'storeName', width: 120, fixed: 'left' },
    { title: '客户名称', dataIndex: 'customerName', width: 160 },
    { title: '联系人', dataIndex: 'contact', width: 80 },
    { title: '手机号', dataIndex: 'phone', width: 120 },
    { title: '工单号', dataIndex: 'orderNo', width: 160 },
    { title: '安装日期', dataIndex: 'installDate', width: 110, render: (v) => v || '-' },
    { title: 'MAC', dataIndex: 'mac', width: 150, render: (v) => v || '-' },
    { title: '合同周期', dataIndex: 'contractPeriod', width: 200 },
    { title: '价格', dataIndex: 'price', width: 100, render: (v) => v || '-' },
    { title: '已回款', dataIndex: 'paidAmount', width: 100, render: (v) => formatMoney(v || 0) },
    { title: '未回款', dataIndex: 'unpaidAmount', width: 100, render: (v) => <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>{formatMoney(v || 0)}</span> },
    { title: '最近回款', width: 120, render: (_, r) => r.lastPaymentTime ? `${r.lastPaymentTime} ${formatMoney(r.lastPaymentAmount)}` : '-' },
    { title: '开票类型', dataIndex: 'invoiceType', width: 130 },
    { title: '负责销售', dataIndex: 'salesName', width: 90 },
    { title: '联系状态', dataIndex: 'contactStatus', width: 90, render: (s) => <Tag color={s === '正常' ? 'success' : 'error'}>{s}</Tag> },
    {
      title: '操作', width: 280, fixed: 'right',
      render: (_, r) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setCurrent(r); setDetailModal(true) }}>详情</Button>
          <Permission code="customer:edit">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          </Permission>
          <ChangeLogButton module="客户" targetId={r.id} />
          {manageOwner && (
            <Button type="link" size="small" onClick={() => { setCurrent(r); transferForm.setFieldsValue({ salesName: r.salesName || undefined }); setTransferOpen(true) }}>转交</Button>
          )}
          <Permission code="customer:payment">
            <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => openPayment(r)}>录入回款</Button>
          </Permission>
          <Permission code="customer:payment-log">
            <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => openHistory(r)}>回款记录</Button>
          </Permission>
          <Permission code="customer:delete">
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </Permission>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>合作客户查询</h2>
        <p>客户、工单、设备、合同、财务信息聚合视图</p>
      </div>
      <OwnerReviewPanel onChanged={() => load()} />
      <ListToolbar
        filters={(
          <>
          <FilterInput
            placeholder="客户/店名/手机号/联系人"
            value={filters.keyword}
            onChange={(e) => setFilter('keyword', e.target.value)}
            onPressEnter={handleSearch}
          />
          {filterBySales && (
            <FilterSelect
              placeholder="负责销售"
              value={filters.salesName || undefined}
              onChange={onSelectFilter('salesName')}
              options={salesOptions.map((item) => ({ value: item.name, label: item.name }))}
            />
          )}
          <FilterSelect
            placeholder="联系状态"
            value={filters.contactStatus || undefined}
            onChange={onSelectFilter('contactStatus')}
            options={CONTACT_STATUSES.map((v) => ({ value: v, label: v }))}
          />
          <FilterSelect
            wide
            placeholder="开票类型"
            value={filters.invoiceType || undefined}
            onChange={onSelectFilter('invoiceType')}
            options={INVOICE_TYPES.map((v) => ({ value: v, label: v }))}
          />
          <FilterField
            placeholder="工单号"
            value={filters.orderNo}
            onChange={(e) => setFilter('orderNo', e.target.value)}
            onPressEnter={handleSearch}
          />
          <FilterField
            placeholder="MAC"
            value={filters.mac}
            onChange={(e) => setFilter('mac', e.target.value)}
            onPressEnter={handleSearch}
          />
          <FilterField
            placeholder="ICCID"
            value={filters.iccid}
            onChange={(e) => setFilter('iccid', e.target.value)}
            onPressEnter={handleSearch}
          />
          <FilterSelect
            placeholder="运营商"
            value={filters.operator || undefined}
            onChange={onSelectFilter('operator')}
            options={OPERATORS.map((v) => ({ value: v, label: v }))}
          />
          <FilterSelect
            placeholder="安装状态"
            value={filters.installed || undefined}
            onChange={onSelectFilter('installed')}
            options={[{ value: 'yes', label: '已安装' }, { value: 'no', label: '未安装' }]}
          />
          <FilterSelect
            placeholder="回款状态"
            value={filters.hasPayment || undefined}
            onChange={onSelectFilter('hasPayment')}
            options={[{ value: 'yes', label: '已回款' }, { value: 'no', label: '未回款' }]}
          />
          <QueryButton loading={loading} onClick={handleSearch} />
          <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <>
            <Permission code="customer:create">
              <Button icon={<PlusOutlined />} onClick={() => openEdit(null)}>新增客户</Button>
            </Permission>
            <Permission code="customer:import">
              <Button icon={<DownloadOutlined />} onClick={() => downloadCsvTemplate(CUSTOMER_TEMPLATE)}>下载模板</Button>
              <Upload showUploadList={false} accept={IMPORT_ACCEPT} beforeUpload={handleImport}>
                <Button icon={<UploadOutlined />}>批量导入</Button>
              </Upload>
            </Permission>
            <Permission code="customer:export">
              <ExportButton filename="customers.csv" label="导出" data={data} columns={columns} />
            </Permission>
          </>
        )}
      />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 2000 }} pagination={pagination} />

      <Modal title={`客户详情 — ${current?.customerName}`} open={detailModal} onCancel={() => setDetailModal(false)} footer={null} width={720}>
        {current && (
          <>
            <CustomerAiSummary customer={current} visible={detailModal} />
            <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="店名">{current.storeName}</Descriptions.Item>
            <Descriptions.Item label="客户">{current.customerName}</Descriptions.Item>
            <Descriptions.Item label="联系人">{current.contact}</Descriptions.Item>
            <Descriptions.Item label="手机">{current.phone}</Descriptions.Item>
            <Descriptions.Item label="工单号">{current.orderNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="安装日期">{current.installDate || '-'}</Descriptions.Item>
            <Descriptions.Item label="设备">{current.deviceSupplier} {current.deviceModel}</Descriptions.Item>
            <Descriptions.Item label="MAC">{current.mac || '-'}</Descriptions.Item>
            <Descriptions.Item label="IMEI">{current.imei || '-'}</Descriptions.Item>
            <Descriptions.Item label="ICCID">{current.iccid || '-'}</Descriptions.Item>
            <Descriptions.Item label="ICCID2">{current.iccid2 || current.backupIccid || '-'}</Descriptions.Item>
            <Descriptions.Item label="运营商">{current.operator || '-'}</Descriptions.Item>
            <Descriptions.Item label="SIM供应商">{current.simSupplier || '-'}</Descriptions.Item>
            <Descriptions.Item label="合同周期" span={2}>{current.contractPeriod}</Descriptions.Item>
            <Descriptions.Item label="价格">{current.price || '-'}</Descriptions.Item>
            <Descriptions.Item label="开票类型">{current.invoiceType}</Descriptions.Item>
            <Descriptions.Item label="负责销售">{current.salesName || '-'}</Descriptions.Item>
            <Descriptions.Item label="已回款">{formatMoney(current.paidAmount || 0)}</Descriptions.Item>
            <Descriptions.Item label="未回款"><span style={{ color: (current.unpaidAmount || 0) > 0 ? '#ff4d4f' : '#52c41a' }}>{formatMoney(current.unpaidAmount || 0)}</span></Descriptions.Item>
            <Descriptions.Item label="最近回款" span={2}>{current.lastPaymentTime ? `${current.lastPaymentTime} · ${formatMoney(current.lastPaymentAmount)}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="身份证正面">
              {current.idCardFront ? <Image width={120} src={fileUrl(current.idCardFront)} /> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="身份证反面">
              {current.idCardBack ? <Image width={120} src={fileUrl(current.idCardBack)} /> : '-'}
            </Descriptions.Item>
          </Descriptions>
          </>
        )}
      </Modal>

      <Modal title={current?.id ? '编辑客户' : '新增客户'} open={editModal} onOk={handleSave} onCancel={closeEditModal} width={720} destroyOnClose>
        {current?.id && (
          <Descriptions column={2} bordered size="small" style={{ marginTop: 8 }}>
            <Descriptions.Item label="已回款">{formatMoney(current.paidAmount || 0)}</Descriptions.Item>
            <Descriptions.Item label="未回款">
              <span style={{ color: (current.unpaidAmount || 0) > 0 ? '#ff4d4f' : '#52c41a' }}>{formatMoney(current.unpaidAmount || 0)}</span>
            </Descriptions.Item>
            <Descriptions.Item label="最近回款" span={2}>
              {current.lastPaymentTime ? `${current.lastPaymentTime} · ${formatMoney(current.lastPaymentAmount)}` : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
          <FormColumnLayout>
          <Form.Item name="storeName" label="店名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contact" label="联系人" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true }]}><Input /></Form.Item>
          {filterBySales ? (
            <Form.Item name="salesName" label="负责销售" rules={[{ required: true, message: '请选择负责销售' }]}>
              <Select showSearch optionFilterProp="label" options={salesOptions.map((item) => ({ value: item.name, label: item.name }))} />
            </Form.Item>
          ) : null}
          <Form.Item name="orderNo" label="工单号"><Input placeholder="GD-20261025-088" /></Form.Item>
          <Form.Item name="installDate" label="安装日期"><Input placeholder="2026-10-27" /></Form.Item>
          <Form.Item name="deviceSupplier" label="设备供应商"><Input placeholder="鲲鹏、华为" /></Form.Item>
          <Form.Item name="deviceModel" label="设备型号"><Input placeholder="618、华为" /></Form.Item>
          <Form.Item name="mac" label="MAC"><Input placeholder="AA:BB:CC:DD:EE:01" /></Form.Item>
          <Form.Item name="imei" label="IMEI"><Input /></Form.Item>
          <Form.Item name="iccid" label="ICCID"><Input /></Form.Item>
          <Form.Item name="iccid2" label="ICCID2"><Input /></Form.Item>
          <Form.Item name="operator" label="运营商">
            <Select allowClear options={OPERATORS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="simSupplier" label="SIM供应商"><Input placeholder="光和、云软" /></Form.Item>
          <Form.Item name="contractPeriod" label="合同周期"><Input placeholder="2026-01-01 至 2027-01-01" /></Form.Item>
          <Form.Item name="price" label="价格"><Input placeholder="2880 或 2880x2=5760" /></Form.Item>
          <Form.Item name="invoiceType" label="开票类型">
            <Select options={INVOICE_TYPES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="contactStatus" label="联系状态">
            <Select options={CONTACT_STATUSES.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item
            name="idCardFront"
            label="身份证正面"
            valuePropName="fileList"
            getValueFromEvent={(e) => e?.fileList}
          >
            <Upload listType="picture-card" maxCount={1} accept="image/*" customRequest={uploadIdCard('idcard')}>
              <div><UploadOutlined /><div style={{ fontSize: 12 }}>正面</div></div>
            </Upload>
          </Form.Item>
          <Form.Item
            name="idCardBack"
            label="身份证反面"
            valuePropName="fileList"
            getValueFromEvent={(e) => e?.fileList}
          >
            <Upload listType="picture-card" maxCount={1} accept="image/*" customRequest={uploadIdCard('idcard')}>
              <div><UploadOutlined /><div style={{ fontSize: 12 }}>反面</div></div>
            </Upload>
          </Form.Item>
          </FormColumnLayout>
        </Form>
      </Modal>

      <Modal title={`转交客户 — ${current?.customerName || ''}`} open={transferOpen} onOk={handleTransfer} onCancel={() => setTransferOpen(false)} destroyOnClose>
        <Form form={transferForm} layout="vertical" preserve={false}>
          <Form.Item name="salesName" label="负责销售" rules={[{ required: true, message: '请选择负责销售' }]}>
            <Select showSearch optionFilterProp="label" options={salesOptions.map((item) => ({ value: item.name, label: item.name }))} />
          </Form.Item>
          <Form.Item name="reason" label="原因"><Input /></Form.Item>
        </Form>
      </Modal>

      <PaymentModal open={payModal} record={financeRecord} onCancel={() => setPayModal(false)} onSubmit={handlePay} />

      <Modal title={`回款记录 — ${current?.customerName}`} open={historyModal} onCancel={() => setHistoryModal(false)} footer={null}>
        {paymentRecords.length ? paymentRecords.map((p) => (
          <p key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{p.time} · {formatMoney(p.amount)} · {p.verified ? '已核销' : '待核销'}</span>
            {p.voucher ? (
              /\.pdf$/i.test(p.voucher)
                ? <a href={fileUrl(p.voucher)} target="_blank" rel="noreferrer">查看凭证</a>
                : <Image width={48} src={fileUrl(p.voucher)} />
            ) : <span>无凭证</span>}
          </p>
        )) : <p>暂无回款记录</p>}
      </Modal>
    </div>
  )
}
