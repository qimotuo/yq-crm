import { useEffect, useMemo, useRef, useState } from 'react'
import { Table, Input, Button, Space, Tag, Progress, Modal, Descriptions, Form, Upload, message, InputNumber, Select, AutoComplete } from 'antd'
import { UploadOutlined, DownloadOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { getIntegratedList, getFinanceList, recordPayment, sendBill, importIntegrated, importIntegratedStream, updateIntegrated } from '../api'
import { downloadXlsxTemplate, parseImportFile, IMPORT_ACCEPT } from '../utils/csvImport'
import { PaymentStatusTag } from '../components/StatusTag'
import { formatMoney } from '../utils/helpers'
import PaymentModal from '../components/PaymentModal'
import { Permission } from '../components/RequireAuth'
import { ListToolbar, FilterInput, FilterField, FilterSelect, QueryButton, ResetButton, applyFilterPatch } from '../components/ListToolbar'
import FormColumnLayout, { modalFormWidth } from '../components/FormColumnLayout'
import ChangeLogButton from '../components/ChangeLogButton'
import ExportButton from '../components/ExportButton'
import { openCreateForm, closeFormModal } from '../utils/formModal'
import { useTablePagination } from '../hooks/useTablePagination'

const IMPORT_HEADERS = [
  '销售姓名', '店名', '公司名称', '联系人', '手机号', '工单号', '安装人', '安装时间', '设备商', '设备型号',
  '设备成本', 'mac地址', 'IMEI', '卡商', '电信卡号', '移动卡号', '更换前旧卡号', '卡套餐', '卡成本',
  '卡到期日', '合同周期', '账单月', '售价', '回款状态', '开票', '合同状态',
]

const INTEGRATED_TEMPLATE = {
  filename: '关联导入模板.xlsx',
  textKeys: ['orderNo', 'mac', 'imei', 'telecomNo', 'mobileNo', 'oldCardNo', 'phone'],
  headers: IMPORT_HEADERS,
  keys: [
    'salesName', 'storeName', 'companyName', 'contact', 'phone', 'orderNo', 'installer', 'installDate', 'deviceSupplier', 'device',
    'deviceCost', 'mac', 'imei', 'simSupplier', 'telecomNo', 'mobileNo', 'oldCardNo', 'cardPackage', 'cardCost',
    'cardExpireDate', 'contractPeriod', 'billMonth', 'price', 'paymentStatus', 'invoiceType', 'contractStatus',
  ],
  aliases: {
    device: ['设备'],
    cardPackage: ['套餐', 'SIM套餐'],
    cardExpireDate: ['卡到期', '卡到期时间', '到期日'],
    deviceCost: ['设备单价'],
    cardCost: ['卡单价', 'SIM成本'],
    price: ['销售价'],
    totalAmount: ['应收', '应收总额'],
    paidAmount: ['已收', '已收/未收', '已收金额'],
    invoiceType: ['开票类型', '发票类型'],
    oldCardNo: ['旧卡号', '更换前卡号'],
    mac: ['MAC地址', 'MAC'],
    phone: ['手机号码', '电话'],
    contractStatus: ['合同'],
    paymentStatus: ['回款'],
  },
  required: ['storeName'],
  optional: IMPORT_HEADERS.slice(2),
  hintKeys: ['paymentStatus', 'invoiceType', 'contractStatus'],
  sample: [
    '张三', '慈弄（腾飞力达店）', '', '', '', '', '赵云', '2024/12/15', '鲲鹏', 'C8-618',
    '600', 'FC83C6169C42', '', '光和', '', '89860489192490089316', '', '单G结算', '0.2',
    '2026/12/31', '2026/1/1-2026/12/31', '12月', '1980', '已回款', '专票', '正常',
  ],
}

const EMPTY_FILTERS = {
  keyword: '',
  salesName: '',
  billMonth: '',
  paymentStatus: '',
  invoiceStatus: '',
  contractStatus: '',
}

const PAYMENT_STATUSES = ['已回款', '部分回款', '已逾期', '未回款']
const CONTRACT_STATUSES = ['正常', '30天后到期', '10天后到期', '3天后到期', '已逾期']
const INVOICE_STATUSES = ['增值税专用发票', '增值税普通发票', '不开发票', '待开票', '已开票']

const DATE_RE = /(\d{4})\D(\d{1,2})\D(\d{1,2})/
const EXCEL_SERIAL_RE = /^\d{5}(?:\.0+)?$/
const SHORT_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/
const CARD_MD_RE = /^(\d{1,2})[/\-.月](\d{1,2})日?$/
const TRUNCATED_RE = /^\d+0{6,}$/
const BLANK_CARD = new Set(['0', '-', '/', '无'])

const LENGTH_BY_KEY = {
  orderNo: ['工单号', 32],
  contact: ['联系人', 64],
  phone: ['手机号', 20],
  installer: ['安装人', 64],
  deviceSupplier: ['设备商', 64],
  device: ['设备型号', 64],
  deviceCost: ['设备成本', 32],
  mac: ['mac地址', 64],
  imei: ['IMEI', 32],
  simSupplier: ['卡商', 64],
  telecomNo: ['电信卡号', 32],
  mobileNo: ['移动卡号', 32],
  oldCardNo: ['更换前旧卡号', 32],
  cardPackage: ['卡套餐', 64],
  cardCost: ['卡成本', 32],
  price: ['售价', 64],
  storeName: ['店名', 128],
  companyName: ['公司名称', 128],
}

const TRUNCATE_LABEL = {
  telecomNo: '电信卡号',
  mobileNo: '移动卡号',
  oldCardNo: '旧卡号',
  imei: 'IMEI',
}

const IMPORT_ENUMS = {
  paymentStatus: ['已回款', '部分回款', '已逾期', '未回款', '已回', '已收款', '未回', '未收款'],
  invoiceType: ['专票', '普票', '不开票', '待开票', '已开票', '增值税专用发票', '增值税普通发票', '不开发票'],
  contractStatus: ['正常', '30天后到期', '10天后到期', '3天后到期', '已逾期', '一个月到期', '30天到期', '即将到期', '10天到期', '三天到期', '3天到期', '已到期'],
}

const FIELD_PLACEHOLDER = {
  installDate: '2024/12/15',
  cardExpireDate: '2026/12/31',
  contractPeriod: '2026/1/1-2026/12/31',
  billMonth: '12月',
  paymentStatus: '已回款',
  invoiceType: '专票',
  contractStatus: '正常',
}

const IMPORT_ERROR_FIELDS = [
  ['更换前旧卡号', 'oldCardNo'],
  ['旧卡号', 'oldCardNo'],
  ['公司名称', 'companyName'],
  ['设备型号', 'device'],
  ['设备成本', 'deviceCost'],
  ['设备商', 'deviceSupplier'],
  ['电信卡号', 'telecomNo'],
  ['移动卡号', 'mobileNo'],
  ['卡到期日', 'cardExpireDate'],
  ['卡套餐', 'cardPackage'],
  ['卡成本', 'cardCost'],
  ['卡商', 'simSupplier'],
  ['mac地址', 'mac'],
  ['IMEI', 'imei'],
  ['工单号', 'orderNo'],
  ['联系人', 'contact'],
  ['手机号', 'phone'],
  ['安装人', 'installer'],
  ['售价', 'price'],
  ['店名', 'storeName'],
]

function pad2(n) {
  return String(n).padStart(2, '0')
}

function normDate(value) {
  const text = String(value ?? '').trim()
  if (EXCEL_SERIAL_RE.test(text)) {
    const serial = Math.trunc(Number(text))
    if (serial >= 20000 && serial <= 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
    }
  }
  const short = text.match(SHORT_DATE_RE)
  if (short) {
    let month = Number(short[1])
    const day = Number(short[2])
    let year = Number(short[3])
    if (year < 100) year += 2000
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${year}-${pad2(month)}-${pad2(day)}`
  }
  const found = text.match(DATE_RE)
  if (!found) return text
  return `${found[1]}-${pad2(Number(found[2]))}-${pad2(Number(found[3]))}`
}

function normCardExpire(value, refDate) {
  const text = String(value ?? '').trim()
  const md = text.match(CARD_MD_RE)
  const ref = String(refDate ?? '').match(DATE_RE)
  if (md && ref) {
    const month = Number(md[1])
    const day = Number(md[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year = Number(ref[1])
      if (month < Number(ref[2]) || (month === Number(ref[2]) && day < Number(ref[3]))) year += 1
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }
  return normDate(text)
}

function blankCard(value) {
  return BLANK_CARD.has(value) ? '' : value
}

function lengthRule(label, limit) {
  return {
    validator: (_, value) => {
      const text = String(value ?? '').trim()
      if (text.length > limit) {
        return Promise.reject(new Error(`${label}「${text.slice(0, 40)}」超过 ${limit} 个字符，请一格只填一个值`))
      }
      return Promise.resolve()
    },
  }
}

function truncateRule(name, label) {
  return {
    validator: (_, value) => {
      const text = name === 'imei' ? String(value ?? '').trim() : blankCard(String(value ?? '').trim())
      if (TRUNCATED_RE.test(text)) {
        return Promise.reject(new Error(`${label}「${text}」疑似被 Excel 截断，请将该列设为文本格式后重新填写`))
      }
      return Promise.resolve()
    },
  }
}

function cardExpireRule(getFieldValue) {
  return {
    validator: (_, value) => {
      const raw = String(value ?? '').trim()
      if (!raw) return Promise.resolve()
      const result = normCardExpire(raw, normDate(getFieldValue('installDate')))
      if (result.length > 16) {
        return Promise.reject(new Error(`卡到期日「${result.slice(0, 40)}」格式无法识别`))
      }
      return Promise.resolve()
    },
  }
}

const FIELD_RULES = {}
Object.entries(LENGTH_BY_KEY).forEach(([name, [label, limit]]) => {
  FIELD_RULES[name] = [lengthRule(label, limit)]
})
FIELD_RULES.storeName = [{ required: true, whitespace: true, message: '店名为空' }, ...FIELD_RULES.storeName]
Object.entries(TRUNCATE_LABEL).forEach(([name, label]) => {
  FIELD_RULES[name] = [...(FIELD_RULES[name] || []), truncateRule(name, label)]
})

function importErrorText(raw) {
  return String(raw || '').replace(/^第\s*\d+\s*行：/, '').trim()
}

function applyImportError(form, raw) {
  const text = importErrorText(raw)
  if (!text) return false
  let name = ''
  if (/店名为空|缺少必填：店名/.test(text)) name = 'storeName'
  else name = IMPORT_ERROR_FIELDS.find(([label]) => text.includes(label))?.[1] || ''
  if (!name) return false
  const messageText = /店名为空/.test(text) ? '店名为空' : text
  form.setFields([{ name, errors: [messageText] }])
  form.scrollToField(name)
  return true
}

function leafColumns(cols) {
  return cols.flatMap((col) => (col.children ? leafColumns(col.children) : col.dataIndex ? [col] : []))
}

function buildQueryParams(query) {
  const params = {}
  Object.entries(query).forEach(([key, value]) => {
    if (value) params[key] = value
  })
  return params
}

export default function IntegratedQuery() {
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const importLogRef = useRef(null)
  const [data, setData] = useState([])
  const { pagination } = useTablePagination(10, data.length)
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [query, setQuery] = useState({ ...EMPTY_FILTERS })
  const [assetModal, setAssetModal] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [billModal, setBillModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const [financeRecord, setFinanceRecord] = useState(null)
  const [billForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [editOpen, setEditOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const cardExpireRules = useMemo(
    () => [cardExpireRule((name) => createForm.getFieldValue(name))],
    [createForm],
  )

  const load = async (params = query) => {
    setLoading(true)
    try {
      const res = await getIntegratedList(buildQueryParams(params))
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [query])

  useEffect(() => {
    if (importLogRef.current) importLogRef.current.scrollTop = importLogRef.current.scrollHeight
  }, [importProgress?.errors.length])

  const handleSearch = () => setQuery({ ...filters })

  const handleReset = () => {
    setFilters({ ...EMPTY_FILTERS })
    setQuery({ ...EMPTY_FILTERS })
  }

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))
  const onSelectFilter = (key) => (v) => applyFilterPatch({ [key]: v || '' }, setFilters, setQuery)

  const patchImport = (data, extra = {}) => {
    setImportProgress((prev) => ({
      total: data.total ?? prev?.total ?? 0,
      done: data.done ?? prev?.done ?? 0,
      created: data.created ?? prev?.created ?? 0,
      updated: data.updated ?? prev?.updated ?? 0,
      failed: data.failed ?? prev?.failed ?? 0,
      errors: prev?.errors || [],
      running: true,
      ...extra,
    }))
  }

  const handleImport = async (file) => {
    let rows
    try {
      rows = await parseImportFile(file, INTEGRATED_TEMPLATE)
    } catch (e) {
      message.error(e.message || '导入失败')
      return false
    }
    setImporting(true)
    setImportProgress({ total: rows.length, done: 0, created: 0, updated: 0, failed: 0, errors: [], running: true })
    try {
      await importIntegratedStream(rows, {
        onProgress: (data) => patchImport(data),
        onRowError: (data) => {
          setImportProgress((prev) => ({
            total: data.total,
            done: data.done,
            created: data.created,
            updated: data.updated,
            failed: data.failed,
            errors: [...(prev?.errors || []), data.message],
            running: true,
          }))
        },
        onDone: (data) => patchImport(data, { running: false }),
      })
      await load()
    } catch (e) {
      setImportProgress((prev) => prev && ({
        ...prev,
        running: false,
        errors: prev.errors.includes(e.message) ? prev.errors : [...prev.errors, e.message],
      }))
      message.error(e.message || '导入失败')
    } finally {
      setImporting(false)
    }
    return false
  }

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

  const openEdit = (record) => {
    setCurrent(record)
    editForm.setFieldsValue({
      salesName: record.salesName,
      storeName: record.storeName,
      customerName: record.customerName,
      contact: record.contact,
      phone: record.phone,
      contactStatus: record.contactStatus,
      installer: record.installer,
      installDate: record.installDate,
      deviceSupplier: record.deviceSupplier,
      deviceModel: record.deviceModel,
      deviceCost: record.deviceCost,
      mac: record.mac,
      imei: record.imei,
      simSupplier: record.simSupplier,
      telecomNo: record.telecomNo,
      mobileNo: record.mobileNo,
      oldCardNo: record.oldCardNo,
      cardPackage: record.cardPackage,
      cardCost: record.cardCost,
      cardExpireDate: record.cardExpireDate,
      contractPeriod: record.contractPeriod,
      billMonth: record.billMonth,
      price: record.price,
      invoiceStatus: record.invoiceStatus,
      paymentPlanDate: record.paymentPlanDate,
      totalAmount: record.totalAmount,
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    const values = await editForm.validateFields()
    await updateIntegrated({ id: current.id, ...values, totalAmount: Number(values.totalAmount) || 0 })
    message.success('关联记录已更新')
    setEditOpen(false)
    load()
  }

  const openCreate = () => {
    openCreateForm(createForm)
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    let values
    try {
      values = await createForm.validateFields()
    } catch {
      return
    }
    const row = {}
    INTEGRATED_TEMPLATE.keys.forEach((key) => {
      row[key] = String(values[key] ?? '').trim()
    })
    setCreating(true)
    try {
      const res = await importIntegrated([row])
      if (res?.errors?.length) {
        const text = res.errors[0]
        if (!applyImportError(createForm, text)) message.error(importErrorText(text) || '新增失败')
        return
      }
      message.success(res?.updated && !res?.created ? '已按导入规则更新已有记录' : '新增成功')
      closeFormModal(createForm, setCreateOpen)
      await load()
    } catch (e) {
      if (!applyImportError(createForm, e.message)) message.error(e.message || '新增失败')
    } finally {
      setCreating(false)
    }
  }

  const handleSendBill = async () => {
    const values = await billForm.validateFields()
    await sendBill({ ...values, id: financeRecord.id, customerName: financeRecord.customerName })
    message.success('对账单已发送')
    setBillModal(false)
  }

  const contractColor = {
    正常: 'success', 一个月到期: 'gold', '30天后到期': 'gold', '10天到期': 'orange', '10天后到期': 'orange',
    三天到期: 'red', '3天后到期': 'red', 已到期: 'error', 已逾期: 'error', 即将到期: 'warning',
  }

  const text = (v) => v || '-'

  const columns = [
    {
      title: '客户',
      children: [
        { title: '销售姓名', dataIndex: 'salesName', width: 90 },
        { title: '店名', dataIndex: 'storeName', width: 130 },
        { title: '公司名称', dataIndex: 'customerName', width: 160 },
        { title: '联系人', dataIndex: 'contact', width: 90, render: text },
        { title: '手机号', dataIndex: 'phone', width: 120, render: text },
      ],
    },
    {
      title: '工单',
      children: [
        { title: '工单号', dataIndex: 'orderNo', width: 150 },
        { title: '安装人', dataIndex: 'installer', width: 90, render: text },
        { title: '安装时间', dataIndex: 'installDate', width: 110, render: text },
      ],
    },
    {
      title: '设备',
      children: [
        { title: '设备商', dataIndex: 'deviceSupplier', width: 90, render: text },
        { title: '设备型号', dataIndex: 'deviceModel', width: 110, render: text },
        { title: '设备成本', dataIndex: 'deviceCost', width: 90, render: text },
        { title: 'mac地址', dataIndex: 'mac', width: 140, render: text },
        { title: 'IMEI', dataIndex: 'imei', width: 140, render: text },
      ],
    },
    {
      title: '卡',
      children: [
        { title: '卡商', dataIndex: 'simSupplier', width: 90, render: text },
        { title: '电信卡号', dataIndex: 'telecomNo', width: 160, render: text },
        { title: '移动卡号', dataIndex: 'mobileNo', width: 140, render: text },
        { title: '更换前旧卡号', dataIndex: 'oldCardNo', width: 140, render: text },
        { title: '卡套餐', dataIndex: 'cardPackage', width: 100, render: text },
        { title: '卡成本', dataIndex: 'cardCost', width: 90, render: text },
        { title: '卡到期日', dataIndex: 'cardExpireDate', width: 110, render: text },
      ],
    },
    {
      title: '合同财务',
      children: [
        { title: '合同周期', dataIndex: 'contractPeriod', width: 180, render: text },
        { title: '账单月', dataIndex: 'billMonth', width: 90, render: text },
        { title: '售价', dataIndex: 'price', width: 80, render: text },
        { title: '回款状态', dataIndex: 'paymentStatus', width: 90, render: (s) => <PaymentStatusTag status={s} /> },
        { title: '开票', dataIndex: 'invoiceStatus', width: 110, render: text },
        { title: '合同状态', dataIndex: 'contractStatus', width: 120, render: (s) => <Tag color={contractColor[s]}>{s}</Tag> },
      ],
    },
    {
      title: '系统计算',
      children: [
        { title: '联系状态', dataIndex: 'contactStatus', width: 90, render: (s) => <Tag color={s === '正常' ? 'success' : 'error'}>{s}</Tag> },
        { title: '资产健康', dataIndex: 'assetHealth', width: 90, render: (s) => <Tag color={s === '离线预警' ? 'error' : 'success'}>{s}</Tag> },
        { title: '应收', dataIndex: 'totalAmount', width: 90, render: formatMoney },
        { title: '已收', dataIndex: 'paidAmount', width: 90, render: formatMoney },
        { title: '未收', dataIndex: 'unpaidAmount', width: 90, render: (v) => <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>{formatMoney(v)}</span> },
        { title: '计划日', dataIndex: 'paymentPlanDate', width: 110, render: text },
        { title: '进度', width: 100, render: (_, r) => <Progress percent={r.totalAmount ? Math.round((r.paidAmount / r.totalAmount) * 100) : 0} size="small" /> },
      ],
    },
    {
      title: '操作', width: 260, fixed: 'right',
      render: (_, r) => (
        <Space size="small" wrap>
          <Permission code="integrated:edit">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          </Permission>
          <ChangeLogButton module="关联" targetId={r.id} />
          <Permission code="integrated:asset">
            <Button type="link" size="small" onClick={() => { setCurrent(r); setAssetModal(true) }}>资产</Button>
          </Permission>
          <Permission code="integrated:send">
            <Button type="link" size="small" onClick={async () => {
              const res = await getFinanceList({ orderNo: r.orderNo })
              if (!res.list.length) return message.warning('未找到账单')
              setFinanceRecord(res.list[0])
              billForm.setFieldsValue({ email: '' })
              setBillModal(true)
            }}>对账单</Button>
          </Permission>
          <Permission code="integrated:payment">
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
      <ListToolbar
        filters={(
          <>
            <FilterInput
              placeholder="客户/工单/门店/手机/MAC/卡号"
              value={filters.keyword}
              onChange={(e) => setFilter('keyword', e.target.value)}
              onPressEnter={handleSearch}
            />
            <FilterField
              placeholder="销售"
              value={filters.salesName}
              onChange={(e) => setFilter('salesName', e.target.value)}
              onPressEnter={handleSearch}
            />
            <FilterField
              placeholder="6 / 2026-06"
              value={filters.billMonth}
              onChange={(e) => setFilter('billMonth', e.target.value)}
              onPressEnter={handleSearch}
            />
            <FilterSelect
              placeholder="回款状态"
              value={filters.paymentStatus || undefined}
              onChange={onSelectFilter('paymentStatus')}
              options={PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))}
            />
            <FilterSelect
              wide
              placeholder="开票"
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
            <QueryButton loading={loading} onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <>
            <Permission code="integrated:import">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增</Button>
              <Button icon={<DownloadOutlined />} onClick={() => downloadXlsxTemplate(INTEGRATED_TEMPLATE)}>下载模板</Button>
              <Upload accept={IMPORT_ACCEPT} showUploadList={false} beforeUpload={handleImport} disabled={importing}>
                <Button icon={<UploadOutlined />} loading={importing}>关联导入</Button>
              </Upload>
            </Permission>
            <Permission code="integrated:export">
              <ExportButton filename="integrated.csv" label="导出" data={data} columns={leafColumns(columns)} />
            </Permission>
          </>
        )}
      />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading || importing} scroll={{ x: 4400 }} pagination={pagination} bordered />

      <Modal
        title="关联导入"
        open={!!importProgress}
        closable={!importProgress?.running}
        maskClosable={false}
        onCancel={() => { if (!importProgress?.running) setImportProgress(null) }}
        footer={(
          <Button type="primary" disabled={importProgress?.running} onClick={() => setImportProgress(null)}>知道了</Button>
        )}
      >
        {importProgress && (
          <>
            <Progress
              percent={importProgress.total ? Math.round(importProgress.done / importProgress.total * 100) : 0}
              status={importProgress.running ? 'active' : importProgress.failed ? 'exception' : 'success'}
            />
            <div style={{ marginBottom: 8 }}>
              已处理 {importProgress.done}/{importProgress.total}，新建 {importProgress.created}，更新 {importProgress.updated}，失败 {importProgress.failed}
            </div>
            <div ref={importLogRef} style={{ maxHeight: 240, overflow: 'auto', background: '#fff2f0', borderRadius: 6, padding: '8px 12px' }}>
              {importProgress.errors.length
                ? importProgress.errors.map((item, i) => <div key={i} style={{ color: '#cf1322' }}>{item}</div>)
                : <div style={{ color: '#999' }}>{importProgress.running ? '正在导入…' : '没有失败记录'}</div>}
            </div>
          </>
        )}
      </Modal>

      <Modal title={`资产明细 — ${current?.storeName || ''}`} open={assetModal} onCancel={() => setAssetModal(false)} footer={null} width={720}>
        {current && (
          <>
            <Descriptions title="客户" column={2} bordered size="small" style={{ marginTop: 8 }}>
              <Descriptions.Item label="销售姓名">{current.salesName || '-'}</Descriptions.Item>
              <Descriptions.Item label="店名">{current.storeName || '-'}</Descriptions.Item>
              <Descriptions.Item label="公司名称">{current.customerName || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系人">{current.contact || '-'}</Descriptions.Item>
              <Descriptions.Item label="手机号">{current.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系状态">{current.contactStatus || '-'}</Descriptions.Item>
            </Descriptions>
            <Descriptions title="工单" column={2} bordered size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="工单号">{current.orderNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="安装人">{current.installer || '-'}</Descriptions.Item>
              <Descriptions.Item label="安装时间">{current.installDate || '-'}</Descriptions.Item>
            </Descriptions>
            <Descriptions title="设备" column={2} bordered size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="设备商">{current.deviceSupplier || '-'}</Descriptions.Item>
              <Descriptions.Item label="设备型号">{current.deviceModel || '-'}</Descriptions.Item>
              <Descriptions.Item label="设备成本">{current.deviceCost || '-'}</Descriptions.Item>
              <Descriptions.Item label="MAC">{current.mac || '-'}</Descriptions.Item>
              <Descriptions.Item label="IMEI">{current.imei || '-'}</Descriptions.Item>
              <Descriptions.Item label="资产健康"><Tag color={current.assetHealth === '离线预警' ? 'error' : 'success'}>{current.assetHealth}</Tag></Descriptions.Item>
            </Descriptions>
            <Descriptions title="卡" column={2} bordered size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="卡商">{current.simSupplier || '-'}</Descriptions.Item>
              <Descriptions.Item label="电信卡号">{current.telecomNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="移动卡号">{current.mobileNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="更换前旧卡号">{current.oldCardNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="卡套餐">{current.cardPackage || '-'}</Descriptions.Item>
              <Descriptions.Item label="卡成本">{current.cardCost || '-'}</Descriptions.Item>
              <Descriptions.Item label="卡到期日">{current.cardExpireDate || '-'}</Descriptions.Item>
            </Descriptions>
            <Descriptions title="合同财务" column={2} bordered size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="合同周期">{current.contractPeriod || '-'}</Descriptions.Item>
              <Descriptions.Item label="账单月">{current.billMonth || '-'}</Descriptions.Item>
              <Descriptions.Item label="售价">{current.price || '-'}</Descriptions.Item>
              <Descriptions.Item label="回款状态">{current.paymentStatus || '-'}</Descriptions.Item>
              <Descriptions.Item label="开票">{current.invoiceStatus || '-'}</Descriptions.Item>
              <Descriptions.Item label="合同状态">{current.contractStatus || '-'}</Descriptions.Item>
              <Descriptions.Item label="应收">{formatMoney(current.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="已收">{formatMoney(current.paidAmount)}</Descriptions.Item>
              <Descriptions.Item label="未收">{formatMoney(current.unpaidAmount)}</Descriptions.Item>
              <Descriptions.Item label="计划日">{current.paymentPlanDate || '-'}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>

      <Modal
        title="新增关联"
        open={createOpen}
        confirmLoading={creating}
        onOk={handleCreate}
        onCancel={() => { if (!creating) closeFormModal(createForm, setCreateOpen) }}
        width={modalFormWidth(INTEGRATED_TEMPLATE.keys.length)}
        destroyOnClose
        maskClosable={!creating}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 8 }} preserve={false}>
          <FormColumnLayout>
            {INTEGRATED_TEMPLATE.headers.map((label, index) => {
              const name = INTEGRATED_TEMPLATE.keys[index]
              const options = IMPORT_ENUMS[name]
              const rules = name === 'cardExpireDate' ? cardExpireRules : FIELD_RULES[name]
              return (
                <Form.Item
                  key={name}
                  name={name}
                  label={label}
                  rules={rules}
                  dependencies={name === 'cardExpireDate' ? ['installDate'] : undefined}
                >
                  {options ? (
                    <AutoComplete
                      allowClear
                      style={{ width: '100%' }}
                      placeholder={FIELD_PLACEHOLDER[name]}
                      options={options.map((value) => ({ value }))}
                    />
                  ) : (
                    <Input placeholder={FIELD_PLACEHOLDER[name]} />
                  )}
                </Form.Item>
              )
            })}
          </FormColumnLayout>
        </Form>
      </Modal>

      <Modal title="编辑关联" open={editOpen} onOk={handleEdit} onCancel={() => setEditOpen(false)} width={modalFormWidth(20)}>
        <Form form={editForm} layout="vertical" style={{ marginTop: 8 }} preserve={false}>
          <FormColumnLayout>
            <Form.Item name="salesName" label="销售姓名"><Input /></Form.Item>
            <Form.Item name="storeName" label="店名" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="customerName" label="公司名称" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="contact" label="联系人"><Input /></Form.Item>
            <Form.Item name="phone" label="手机号"><Input maxLength={11} /></Form.Item>
            <Form.Item name="contactStatus" label="联系状态">
              <Select options={['正常', '中断合作', '待跟进'].map((v) => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="installer" label="安装人"><Input /></Form.Item>
            <Form.Item name="installDate" label="安装时间"><Input /></Form.Item>
            <Form.Item name="deviceSupplier" label="设备商"><Input /></Form.Item>
            <Form.Item name="deviceModel" label="设备型号"><Input /></Form.Item>
            <Form.Item name="deviceCost" label="设备成本"><Input /></Form.Item>
            <Form.Item name="mac" label="MAC"><Input /></Form.Item>
            <Form.Item name="imei" label="IMEI"><Input /></Form.Item>
            <Form.Item name="simSupplier" label="卡商"><Input /></Form.Item>
            <Form.Item name="telecomNo" label="电信卡号"><Input /></Form.Item>
            <Form.Item name="mobileNo" label="移动卡号"><Input /></Form.Item>
            <Form.Item name="oldCardNo" label="更换前旧卡号"><Input /></Form.Item>
            <Form.Item name="cardPackage" label="卡套餐"><Input /></Form.Item>
            <Form.Item name="cardCost" label="卡成本"><Input /></Form.Item>
            <Form.Item name="cardExpireDate" label="卡到期日"><Input /></Form.Item>
            <Form.Item name="contractPeriod" label="合同周期"><Input /></Form.Item>
            <Form.Item name="billMonth" label="账单月"><Input /></Form.Item>
            <Form.Item name="price" label="售价"><Input /></Form.Item>
            <Form.Item name="totalAmount" label="应收"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="paymentPlanDate" label="计划日"><Input /></Form.Item>
            <Form.Item name="invoiceStatus" label="开票">
              <Select options={['增值税专用发票', '增值税普通发票', '不开发票', '待开票', '已开票'].map((v) => ({ value: v, label: v }))} />
            </Form.Item>
          </FormColumnLayout>
        </Form>
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
