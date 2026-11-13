import { useEffect, useRef, useState } from 'react'
import { Table, Button, Space, Input, Select, Tag, Modal, Descriptions, Form, InputNumber, message, Upload, Dropdown, DatePicker, AutoComplete } from 'antd'
import { PrinterOutlined, FileAddOutlined, PlusOutlined, UploadOutlined, DownloadOutlined, DownOutlined, FileTextOutlined, CheckCircleFilled, EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import zhilianTplUrl from '../assets/templates/jimi-zhilian.docx?url'
import jimiNetTplUrl from '../assets/templates/jimi-net-6.docx?url'
import { getContracts, createContract, updateContract, importContracts, generateContract, getContractFillSources, previewContract, downloadContractFile } from '../api'
import { formatMoney } from '../utils/helpers'
import ContractPrint from '../components/ContractPrint'
import { Permission } from '../components/RequireAuth'
import { openCreateForm, closeFormModal } from '../utils/formModal'
import { parseImportFile, IMPORT_ACCEPT } from '../utils/csvImport'
import { ListToolbar, FilterInput, FilterField, FilterSelect, QueryButton, ResetButton, applyFilterPatch } from '../components/ListToolbar'
import FormColumnLayout, { modalFormWidth } from '../components/FormColumnLayout'
import ChangeLogButton from '../components/ChangeLogButton'
import ExportButton from '../components/ExportButton'
import { useTablePagination } from '../hooks/useTablePagination'
import { canFilterBySales } from '../rbac/utils'

const PHONE_RULE = [{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '请输入11位手机号' }]
const ID_RULE = [{ required: true, message: '请输入身份证号' }, { pattern: /^\d{17}[\dXx]$/, message: '请输入18位身份证号' }]

const CONTRACT_TEMPLATE = {
  filename: '合同导入模板.csv',
  headers: ['工单号', '客户名称', '签署人姓名', '手机号', '身份证号', '签署日期', '门店', '套餐', '金额', '起始日期', '截止日期', '城市代码', '状态'],
  keys: ['orderNo', 'customerName', 'signerName', 'signerPhone', 'signerIdNo', 'signDate', 'storeName', 'package', 'amount', 'startDate', 'endDate', 'cityCode', 'status'],
  sample: ['GD-20261025-088', '智慧社区A区物业', '小王', '13800138000', '310101199001011234', '2026-11-02', '红渡小香', '企业旗舰版(5账号)', '12000', '2026-11-02', '2027-11-01', 'SH', '待生成'],
  required: ['orderNo', 'customerName', 'signerName', 'signerPhone', 'signerIdNo', 'signDate', 'storeName', 'amount', 'startDate', 'endDate'],
}

const CONTRACT_STATUSES = ['正常', '30天后到期', '10天后到期', '3天后到期', '已逾期', '待生成']
const CONTRACT_FORM_STATUSES = ['正常', '待生成']

const EMPTY_FILTERS = {
  keyword: '',
  status: '',
  templateKey: '',
  storeName: '',
  salesName: '',
  cityCode: '',
  package: '',
  signDate: null,
  endDate: null,
}

function toParams(filters) {
  const params = {}
  for (const key of ['keyword', 'status', 'templateKey', 'storeName', 'salesName', 'cityCode', 'package']) {
    const value = (filters[key] || '').trim()
    if (value) params[key] = value
  }
  if (filters.signDate?.[0]) params.signDateFrom = filters.signDate[0].format('YYYY-MM-DD')
  if (filters.signDate?.[1]) params.signDateTo = filters.signDate[1].format('YYYY-MM-DD')
  if (filters.endDate?.[0]) params.endDateFrom = filters.endDate[0].format('YYYY-MM-DD')
  if (filters.endDate?.[1]) params.endDateTo = filters.endDate[1].format('YYYY-MM-DD')
  return params
}

const CONTRACT_DOC_TEMPLATES = [
  { key: 'zhilian', label: '基米智连空白协议模板.docx', href: zhilianTplUrl, filename: '基米智连空白协议模板.docx' },
  { key: 'jimi6', label: '基米网6%空白合同.docx', href: jimiNetTplUrl, filename: '基米网6%空白合同.docx' },
]

function downloadDocTemplate(href, filename) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function templateLabel(key) {
  const item = CONTRACT_DOC_TEMPLATES.find((t) => t.key === key)
  return item ? item.label.replace(/\.docx$/, '') : '-'
}

const NET_TEMPLATE = 'jimi6'
const CN_NUM = '零壹贰叁肆伍陆柒捌玖'
const CN_SEC = ['', '拾', '佰', '仟']
const CN_GRP = ['', '万', '亿', '兆']

function fourDigits(n) {
  if (n <= 0) return ''
  const digits = String(n).padStart(4, '0')
  let out = ''
  let zero = false
  for (let i = 0; i < 4; i += 1) {
    const d = Number(digits[i])
    if (d === 0) { zero = true; continue }
    if (zero && out) out += '零'
    zero = false
    out += CN_NUM[d] + CN_SEC[3 - i]
  }
  return out
}

function rmbUpper(amount) {
  const cents = Math.round(Number(amount) * 100)
  if (!Number.isFinite(cents) || cents <= 0) return ''
  let n = Math.floor(cents / 100)
  const frac = cents % 100
  const groups = []
  if (n === 0) groups.push(0)
  while (n > 0) { groups.push(n % 10000); n = Math.floor(n / 10000) }
  const chunks = []
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i]
    if (group === 0) { chunks.push('零'); continue }
    const text = fourDigits(group) + CN_GRP[i]
    if (chunks.length && chunks[chunks.length - 1] !== '零' && group < 1000) chunks.push('零')
    chunks.push(text)
  }
  const head = `${chunks.join('').replace(/零零+/g, '零').replace(/^零|零$/g, '')}圆`
  if (frac === 0) return `${head}整`
  const jiao = Math.floor(frac / 10)
  const fen = frac % 10
  if (jiao && fen) return `${head}${CN_NUM[jiao]}角${CN_NUM[fen]}分`
  if (jiao) return `${head}${CN_NUM[jiao]}角`
  return `${head}零${CN_NUM[fen]}分`
}

function mallFromStore(store) {
  const text = String(store || '').trim()
  const matched = text.match(/[（(]([^（）()]+)[）)]\s*$/)
  return matched ? matched[1].trim() : text
}

function cnDate(value) {
  if (!value) return ''
  const d = dayjs(value)
  if (!d.isValid()) return ''
  return `${d.year()}年${d.month() + 1}月${d.date()}日`
}

function fmtDate(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value.format === 'function') return value.format('YYYY-MM-DD')
  return String(value)
}

function asDay(value) {
  if (!value) return null
  if (typeof value.format === 'function') return value
  const d = dayjs(value)
  return d.isValid() ? d : null
}

function parseMoney(value) {
  const n = parseFloat(String(value || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : undefined
}

function blankOrderLine(storeName, signDate) {
  return {
    mallName: mallFromStore(storeName),
    deviceType: '',
    deviceModel: '',
    unitPrice: undefined,
    contractDate: cnDate(signDate),
  }
}

export default function ContractList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const { pagination } = useTablePagination(10, data.length)
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [query, setQuery] = useState({ ...EMPTY_FILTERS })
  const [detail, setDetail] = useState(null)
  const [printContract, setPrintContract] = useState(null)
  const [createModal, setCreateModal] = useState(false)
  const filterBySales = canFilterBySales()
  const [editing, setEditing] = useState(null)
  const [templateMissing, setTemplateMissing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sources, setSources] = useState({ customers: [], sales: [] })
  const [preview, setPreview] = useState(null)
  const [form] = Form.useForm()
  const templateKey = Form.useWatch('templateKey', form)
  const deviceAmountWatch = Form.useWatch('deviceAmount', form)
  const orderLinesWatch = Form.useWatch('orderLines', form)
  const storeWatch = Form.useWatch('storeName', form)
  const net = templateKey === NET_TEMPLATE
  const agentDirty = useRef({})
  const partnerDirty = useRef({})
  const lineAuto = useRef({ mall: '', date: '' })
  const salesPhoneDirty = useRef(false)
  const syncing = useRef(false)
  const orderTotal = (orderLinesWatch || []).reduce((sum, line) => sum + (Number(line?.unitPrice) || 0), 0)

  const load = async (params = query) => {
    setLoading(true)
    try {
      const res = await getContracts(toParams(params))
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => setQuery({ ...filters })

  const handleReset = () => {
    setFilters({ ...EMPTY_FILTERS })
    setQuery({ ...EMPTY_FILTERS })
  }

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))
  const onSelectFilter = (key) => (v) => applyFilterPatch({ [key]: v || '' }, setFilters, setQuery)

  useEffect(() => { load() }, [query])
  useEffect(() => { if (createModal) loadSources() }, [createModal])

  const handleGenerate = async (orderNo) => {
    await generateContract(orderNo)
    message.success('合同已生成')
    load()
  }

  const resetSync = () => {
    agentDirty.current = {}
    partnerDirty.current = {}
    lineAuto.current = { mall: '', date: '' }
    salesPhoneDirty.current = false
  }

  const loadSources = () => {
    getContractFillSources().then((res) => {
      setSources({ customers: res.customers || [], sales: res.sales || [] })
    }).catch(() => setSources({ customers: [], sales: [] }))
  }

  const openPreview = async (record) => {
    try {
      const res = await previewContract(record.id)
      setPreview({ title: res.filename || record.docName || record.contractNo, html: res.html, id: record.id, filename: res.filename || record.docName })
    } catch (e) {
      message.error(e.message || '预览失败')
    }
  }

  const handleDownload = async (record) => {
    try {
      await downloadContractFile(record.id, record.docName || record.filename)
    } catch (e) {
      message.error(e.message || '下载失败')
    }
  }

  const applyCustomer = (id) => {
    const customer = sources.customers.find((item) => item.id === id)
    if (!customer) return
    resetSync()
    const signDate = form.getFieldValue('signDate')
    const mall = mallFromStore(customer.storeName)
    const dateText = cnDate(signDate)
    lineAuto.current = { mall, date: dateText }
    const sales = sources.sales.find((item) => item.name === customer.salesName)
    const price = parseMoney(customer.price)
    syncing.current = true
    form.setFieldsValue({
      orderNo: customer.orderNo || form.getFieldValue('orderNo'),
      storeName: customer.storeName,
      customerName: customer.customerName,
      signerName: customer.contact || '',
      signerPhone: customer.phone || '',
      partyAddress: customer.address || '',
      agentName: customer.contact || '',
      agentPhone: customer.phone || '',
      agentAddress: customer.address || '',
      partnerName: customer.contact || '',
      partnerPhone: customer.phone || '',
      salesName: customer.salesName || '',
      salesPhone: sales?.phone || '',
      ...(price != null ? { deviceAmount: price } : {}),
      orderLines: [{
        mallName: mall,
        deviceType: '',
        deviceModel: customer.deviceModel || '',
        unitPrice: price,
        contractDate: dateText,
      }],
    })
    syncing.current = false
  }

  const onValuesChange = (changed, all) => {
    if (syncing.current || all.templateKey !== NET_TEMPLATE) return
    if ('agentName' in changed) agentDirty.current.name = true
    if ('agentIdNo' in changed) agentDirty.current.id = true
    if ('agentPhone' in changed) agentDirty.current.phone = true
    if ('agentAddress' in changed) agentDirty.current.address = true
    if ('partnerName' in changed) partnerDirty.current.name = true
    if ('partnerIdNo' in changed) partnerDirty.current.id = true
    if ('partnerPhone' in changed) partnerDirty.current.phone = true
    if ('partnerSignDate' in changed) partnerDirty.current.date = true
    if ('salesPhone' in changed) salesPhoneDirty.current = true
    const patch = {}
    if ('signerName' in changed && !agentDirty.current.name) patch.agentName = changed.signerName
    if ('signerIdNo' in changed && !agentDirty.current.id) patch.agentIdNo = changed.signerIdNo
    if ('signerPhone' in changed && !agentDirty.current.phone) patch.agentPhone = changed.signerPhone
    if ('partyAddress' in changed && !agentDirty.current.address) patch.agentAddress = changed.partyAddress
    if ('signerName' in changed && !partnerDirty.current.name) patch.partnerName = changed.signerName
    if ('signerIdNo' in changed && !partnerDirty.current.id) patch.partnerIdNo = changed.signerIdNo
    if ('signerPhone' in changed && !partnerDirty.current.phone) patch.partnerPhone = changed.signerPhone
    if ('signDate' in changed && !partnerDirty.current.date) patch.partnerSignDate = changed.signDate
    if ('salesName' in changed && !salesPhoneDirty.current) {
      const hit = sources.sales.find((item) => item.name === changed.salesName)
      if (hit?.phone) patch.salesPhone = hit.phone
    }
    if ('storeName' in changed || 'signDate' in changed) {
      const mall = 'storeName' in changed ? mallFromStore(changed.storeName) : lineAuto.current.mall
      const dateText = 'signDate' in changed ? cnDate(changed.signDate) : lineAuto.current.date
      const prevMall = lineAuto.current.mall
      const prevDate = lineAuto.current.date
      patch.orderLines = (all.orderLines || []).map((line) => {
        const next = { ...(line || {}) }
        if ('storeName' in changed && (!next.mallName || next.mallName === prevMall)) next.mallName = mall
        if ('signDate' in changed && (!next.contractDate || next.contractDate === prevDate)) next.contractDate = dateText
        return next
      })
      if ('storeName' in changed) lineAuto.current.mall = mall
      if ('signDate' in changed) lineAuto.current.date = dateText
    }
    if (Object.keys(patch).length) {
      syncing.current = true
      form.setFieldsValue(patch)
      syncing.current = false
    }
  }

  const netValues = (record) => {
    const lines = record.orderLines?.length ? record.orderLines : [blankOrderLine(record.storeName, record.signDate)]
    return {
      salesName: record.salesName,
      salesPhone: record.salesPhone,
      productType: record.productType || undefined,
      deviceAmount: record.deviceAmount || undefined,
      partyAddress: record.partyAddress,
      partyBank: record.partyBank,
      partyAccount: record.partyAccount,
      agentName: record.agentName,
      agentIdNo: record.agentIdNo,
      agentTitle: record.agentTitle,
      agentPhone: record.agentPhone,
      agentEmail: record.agentEmail,
      agentAddress: record.agentAddress,
      partnerName: record.partnerName,
      partnerIdNo: record.partnerIdNo,
      partnerPhone: record.partnerPhone,
      partnerSignDate: asDay(record.partnerSignDate || record.signDate),
      orderLines: lines,
      signDate: asDay(record.signDate),
      startDate: asDay(record.startDate),
      endDate: asDay(record.endDate),
    }
  }

  const openEdit = (record) => {
    setEditing(record)
    setTemplateMissing(false)
    resetSync()
    const isNet = record.templateKey === NET_TEMPLATE
    if (isNet) {
      lineAuto.current = { mall: mallFromStore(record.storeName), date: cnDate(record.signDate) }
      agentDirty.current = {
        name: (record.agentName || '') !== (record.signerName || ''),
        id: (record.agentIdNo || '') !== (record.signerIdNo || ''),
        phone: (record.agentPhone || '') !== (record.signerPhone || ''),
        address: (record.agentAddress || '') !== (record.partyAddress || ''),
      }
      partnerDirty.current = {
        name: (record.partnerName || '') !== (record.signerName || ''),
        id: (record.partnerIdNo || '') !== (record.signerIdNo || ''),
        phone: (record.partnerPhone || '') !== (record.signerPhone || ''),
        date: !!(record.partnerSignDate && record.partnerSignDate !== record.signDate),
      }
    }
    form.setFieldsValue({
      templateKey: record.templateKey || undefined,
      orderNo: record.orderNo,
      customerName: record.customerName,
      signerName: record.signerName,
      signerPhone: record.signerPhone,
      signerIdNo: record.signerIdNo,
      signDate: isNet ? asDay(record.signDate) : record.signDate,
      storeName: record.storeName,
      package: record.package,
      amount: record.amount,
      startDate: isNet ? asDay(record.startDate) : record.startDate,
      endDate: isNet ? asDay(record.endDate) : record.endDate,
      cityCode: record.cityCode || 'SH',
      status: record.status === '待生成' ? '待生成' : '正常',
      ...(isNet ? netValues(record) : {}),
    })
    setCreateModal(true)
  }

  const openCreate = () => {
    setEditing(null)
    setTemplateMissing(false)
    resetSync()
    openCreateForm(form, {
      templateKey: undefined,
      orderNo: '', customerName: '', signerName: '', signerPhone: '', signerIdNo: '', signDate: '',
      storeName: '', package: '', amount: 0, startDate: '', endDate: '', cityCode: 'SH', status: '待生成',
    })
    setCreateModal(true)
  }

  const selectTemplate = (key) => {
    const current = form.getFieldsValue()
    const entering = key === NET_TEMPLATE
    const patch = { templateKey: key }
    if (entering) {
      patch.signDate = asDay(current.signDate)
      patch.startDate = asDay(current.startDate)
      patch.endDate = asDay(current.endDate)
      patch.partnerSignDate = asDay(current.partnerSignDate || current.signDate)
      if (!current.agentName && current.signerName) patch.agentName = current.signerName
      if (!current.agentIdNo && current.signerIdNo) patch.agentIdNo = current.signerIdNo
      if (!current.agentPhone && current.signerPhone) patch.agentPhone = current.signerPhone
      if (!current.partnerName && current.signerName) patch.partnerName = current.signerName
      if (!current.partnerIdNo && current.signerIdNo) patch.partnerIdNo = current.signerIdNo
      if (!current.partnerPhone && current.signerPhone) patch.partnerPhone = current.signerPhone
      if (!current.agentAddress && current.partyAddress) patch.agentAddress = current.partyAddress
      if (!current.orderLines?.length) patch.orderLines = [blankOrderLine(current.storeName, current.signDate)]
      lineAuto.current = { mall: mallFromStore(current.storeName), date: cnDate(current.signDate) }
    } else if (current.templateKey === NET_TEMPLATE) {
      patch.signDate = fmtDate(current.signDate)
      patch.startDate = fmtDate(current.startDate)
      patch.endDate = fmtDate(current.endDate)
    }
    form.setFieldsValue(patch)
    setTemplateMissing(false)
  }

  const handleCreate = async () => {
    const picked = form.getFieldValue('templateKey')
    if (!editing) setTemplateMissing(!picked)
    try {
      const values = await form.validateFields()
      const isNet = values.templateKey === NET_TEMPLATE
      const payload = {
        ...values,
        signDate: fmtDate(values.signDate),
        startDate: fmtDate(values.startDate),
        endDate: fmtDate(values.endDate),
        partnerSignDate: fmtDate(values.partnerSignDate),
        cityCode: values.cityCode || 'SH',
        status: values.status || (editing ? '正常' : '待生成'),
      }
      if (isNet) {
        payload.package = values.productType
        payload.amount = (values.orderLines || []).reduce((sum, line) => sum + (Number(line?.unitPrice) || 0), 0)
        payload.orderLines = (values.orderLines || []).map((line) => ({
          mallName: line.mallName || mallFromStore(values.storeName),
          deviceType: line.deviceType,
          deviceModel: line.deviceModel,
          unitPrice: line.unitPrice,
          contractDate: line.contractDate || cnDate(values.signDate),
        }))
      }
      setSaving(true)
      if (editing) {
        await updateContract({ id: editing.id, ...payload })
        message.success(isNet ? '合同已更新并重新生成' : '合同已更新')
      } else {
        await createContract(payload)
        message.success(isNet ? '合同已生成' : '合同已新增')
      }
      setEditing(null)
      setTemplateMissing(false)
      closeFormModal(form, setCreateModal)
      load()
    } catch (e) {
      if (e?.errorFields) return
      message.error(e.message || '生成失败')
    } finally {
      setSaving(false)
    }
  }

  const handleImport = async (file) => {
    try {
      const rows = (await parseImportFile(file, CONTRACT_TEMPLATE)).map((row) => ({
        ...row,
        amount: Number(row.amount) || 0,
        signerPhone: (row.signerPhone || '').trim(),
        signerIdNo: (row.signerIdNo || '').trim().toUpperCase(),
        cityCode: row.cityCode || 'SH',
        status: row.status || '待生成',
      }))
      const res = await importContracts(rows)
      message.success(`成功导入 ${res.count} 条合同`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const statusColor = { 正常: 'success', 一个月到期: 'gold', '30天后到期': 'gold', '10天到期': 'orange', '10天后到期': 'orange', 三天到期: 'red', '3天后到期': 'red', 已到期: 'error', 已逾期: 'error', 即将到期: 'warning', 待生成: 'default' }

  const text = (v) => v || '-'

  const columns = [
    { title: '合同编号', dataIndex: 'contractNo', width: 150, render: text },
    { title: '合同模板', dataIndex: 'templateKey', width: 180, render: (v) => templateLabel(v) },
    { title: '工单号', dataIndex: 'orderNo', width: 140, render: text },
    { title: '店名', dataIndex: 'storeName', width: 130, render: text },
    { title: '公司名称', dataIndex: 'customerName', width: 160, render: text },
    { title: '签署人', dataIndex: 'signerName', width: 90, render: text },
    { title: '手机号', dataIndex: 'signerPhone', width: 130, render: text },
    { title: '身份证号', dataIndex: 'signerIdNo', width: 180, render: text },
    { title: '签署日期', dataIndex: 'signDate', width: 110, render: text },
    { title: '门店', dataIndex: 'storeName', width: 130, render: text },
    { title: '套餐', dataIndex: 'package', width: 120, render: text },
    { title: '售价金额', dataIndex: 'amount', width: 100, render: formatMoney },
    { title: '合同周期', width: 210, render: (_, r) => (r.startDate || r.endDate) ? `${r.startDate || '-'} ~ ${r.endDate || '-'}` : '-' },
    { title: '状态', dataIndex: 'status', width: 120, render: (s) => <Tag color={statusColor[s]}>{s || '-'}</Tag> },
    {
      title: '操作', width: 280, fixed: 'right',
      render: (_, r) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => setDetail(r)}>查看</Button>
          <Permission code="contract:edit">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          </Permission>
          <ChangeLogButton module="合同" targetId={r.id} />
          {r.docPath && (
            <>
              <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => openPreview(r)}>预览</Button>
              <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r)}>下载</Button>
            </>
          )}
          {r.status === '待生成' && !r.docPath && (
            <Permission code="contract:generate">
              <Button type="link" size="small" icon={<FileAddOutlined />} onClick={() => handleGenerate(r.orderNo)}>生成合同</Button>
            </Permission>
          )}
          {r.status !== '待生成' && !r.docPath && (
            <Permission code="contract:print">
              <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => setPrintContract(r)}>打印</Button>
            </Permission>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>合同管理</h2>
        <p>安装完成第 8 天自动生成合同，支持手动补录与打印</p>
      </div>
      <ListToolbar
        filters={(
          <>
            <FilterInput placeholder="合同号/工单/客户/签署人/手机号/门店" value={filters.keyword} onChange={(e) => setFilter('keyword', e.target.value)} onPressEnter={handleSearch} />
            <FilterSelect placeholder="合同状态" value={filters.status || undefined} onChange={onSelectFilter('status')}
              options={CONTRACT_STATUSES.map((s) => ({ value: s, label: s }))} />
            <FilterSelect placeholder="合同模板" style={{ width: 200 }} value={filters.templateKey || undefined} onChange={onSelectFilter('templateKey')}
              options={CONTRACT_DOC_TEMPLATES.map((t) => ({ value: t.key, label: t.label.replace(/\.docx$/, '') }))} />
            <FilterField placeholder="门店" value={filters.storeName} onChange={(e) => setFilter('storeName', e.target.value)} onPressEnter={handleSearch} />
            {filterBySales && (
              <FilterField placeholder="负责销售" value={filters.salesName} onChange={(e) => setFilter('salesName', e.target.value)} onPressEnter={handleSearch} />
            )}
            <FilterField placeholder="套餐" value={filters.package} onChange={(e) => setFilter('package', e.target.value)} onPressEnter={handleSearch} />
            <FilterField placeholder="城市代码" value={filters.cityCode} onChange={(e) => setFilter('cityCode', e.target.value)} onPressEnter={handleSearch} />
            <DatePicker.RangePicker className="stock-filter-date" value={filters.signDate} onChange={(v) => setFilter('signDate', v)} placeholder={['签署开始', '签署结束']} allowClear />
            <DatePicker.RangePicker className="stock-filter-date" value={filters.endDate} onChange={(v) => setFilter('endDate', v)} placeholder={['到期开始', '到期结束']} allowClear />
            <QueryButton loading={loading} onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <Space>
            <Permission code="contract:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增合同</Button>
            </Permission>
            <Permission code="contract:import">
              <Dropdown
                trigger={['click']}
                menu={{
                  items: CONTRACT_DOC_TEMPLATES.map((t) => ({
                    key: t.key,
                    label: t.label,
                    onClick: () => downloadDocTemplate(t.href, t.filename),
                  })),
                }}
              >
                <Button icon={<DownloadOutlined />}>下载模板 <DownOutlined /></Button>
              </Dropdown>
              <Upload accept={IMPORT_ACCEPT} showUploadList={false} beforeUpload={handleImport}>
                <Button icon={<UploadOutlined />}>批量导入</Button>
              </Upload>
            </Permission>
            <Permission code="contract:export">
              <ExportButton filename="contracts.csv" label="导出" data={data} columns={columns} />
            </Permission>
          </Space>
        )}
      />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 2400 }} pagination={pagination} />

      <Modal
        title={editing ? '编辑合同' : '新增合同'}
        open={createModal}
        onOk={handleCreate}
        okText={net ? (editing ? '保存并重新生成' : '生成合同') : '确定'}
        confirmLoading={saving}
        onCancel={() => { setEditing(null); setTemplateMissing(false); closeFormModal(form, setCreateModal) }}
        width={net ? 980 : modalFormWidth(13)}
        styles={{ body: { maxHeight: '72vh', overflow: 'auto' } }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }} onValuesChange={onValuesChange}>
          <Form.Item name="templateKey" hidden rules={editing ? [] : [{ required: true, message: '请选择合同模板' }]}><Input /></Form.Item>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, color: templateMissing ? '#ff4d4f' : 'rgba(0,0,0,0.88)' }}>
              {!editing && <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>}合同模板
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {CONTRACT_DOC_TEMPLATES.map((t) => {
                const active = templateKey === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => selectTemplate(t.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderRadius: 8,
                      padding: '12px 14px',
                      border: `1px solid ${active ? '#1677ff' : '#d9d9d9'}`,
                      background: active ? '#f0f7ff' : '#fff',
                      boxShadow: active ? '0 0 0 2px rgba(22,119,255,0.15)' : 'none',
                    }}
                  >
                    <FileTextOutlined style={{ fontSize: 22, color: active ? '#1677ff' : '#8c8c8c' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600, color: 'rgba(0,0,0,0.88)' }}>{t.label.replace(/\.docx$/, '')}</span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: '#8c8c8c' }}>{t.filename}</span>
                    </span>
                    <CheckCircleFilled style={{ fontSize: 16, color: active ? '#1677ff' : '#d9d9d9' }} />
                  </button>
                )
              })}
            </div>
            {templateMissing && <div style={{ color: '#ff4d4f', marginTop: 6 }}>请选择合同模板</div>}
          </div>
          {net && (
            <div style={{ marginBottom: 12 }}>
              <Select
                showSearch
                allowClear
                placeholder="选择已有客户/门店，自动带出并可修改"
                optionFilterProp="label"
                style={{ width: '100%' }}
                options={sources.customers.map((c) => ({ value: c.id, label: `${c.storeName || '-'} / ${c.customerName || '-'}` }))}
                onChange={applyCustomer}
              />
              <div style={{ marginTop: 6, color: '#8c8c8c', fontSize: 12 }}>乙方固定为基米网（上海）科技有限责任公司，地址、开户行、账号沿用模板。</div>
            </div>
          )}
          <FormColumnLayout>
          <Form.Item name="orderNo" label="工单号" rules={[{ required: true, message: '请填写工单号' }]}><Input placeholder="GD-20261025-088" /></Form.Item>
          <Form.Item name="storeName" label={net ? '店名' : '门店'} extra={net && storeWatch ? `销售订单商场名称默认：${mallFromStore(storeWatch)}` : undefined} rules={[{ required: true, message: net ? '请填写店名' : '请填写门店' }]}><Input placeholder={net ? '野人先生（虹口龙之梦）' : ''} /></Form.Item>
          <Form.Item name="customerName" label={net ? '甲方 / 公司名称' : '客户名称'} rules={[{ required: true, message: net ? '请填写甲方 / 公司名称' : '请填写客户名称' }]}><Input /></Form.Item>
          <Form.Item name="signerName" label={net ? '合同签署人' : '签署人姓名'} rules={net || !editing ? [{ required: true, message: '请填写合同签署人' }] : []}><Input /></Form.Item>
          <Form.Item name="signerPhone" label={net ? '联系方式' : '手机号'} rules={net || !editing ? PHONE_RULE : [{ pattern: /^$|^1\d{10}$/, message: '请输入11位手机号' }]}><Input maxLength={11} /></Form.Item>
          <Form.Item name="signerIdNo" label="身份证号" rules={net || !editing ? ID_RULE : [{ pattern: /^$|^\d{17}[\dXx]$/, message: '请输入18位身份证号' }]}><Input maxLength={18} /></Form.Item>
          <Form.Item name="signDate" label={net ? '合同日期' : '签署日期'} rules={net || !editing ? [{ required: true, message: '请填写合同日期' }] : []}>
            {net ? <DatePicker style={{ width: '100%' }} /> : <Input placeholder="2026-11-02" />}
          </Form.Item>
          {net ? (
            <>
              <Form.Item name="salesName" label="销售" rules={[{ required: true, message: '请填写销售' }]}>
                <AutoComplete options={sources.sales.map((s) => ({ value: s.name }))} placeholder="选择或填写销售" />
              </Form.Item>
              <Form.Item name="salesPhone" label="销售联系电话" rules={PHONE_RULE}><Input maxLength={11} /></Form.Item>
              <Form.Item name="productType" label="产品类型" rules={[{ required: true, message: '请选择产品类型' }]}>
                <Select options={[{ value: '旺铺通', label: '旺铺通' }, { value: '楼宇通', label: '楼宇通' }]} />
              </Form.Item>
              <Form.Item name="startDate" label="合同起始日期" rules={[{ required: true, message: '请填写合同起始日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="endDate" label="合同结束日期" rules={[{ required: true, message: '请填写合同结束日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="deviceAmount" label="设备金额（元）" extra={rmbUpper(deviceAmountWatch) ? `大写：${rmbUpper(deviceAmountWatch)}` : '填写小写金额后自动生成大写'} rules={[{ required: true, message: '请填写设备金额' }]}>
                <InputNumber min={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="package" label="套餐"><Input /></Form.Item>
              <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请填写金额' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="startDate" label="起始日期" rules={editing ? [] : [{ required: true, message: '请填写起始日期' }]}><Input placeholder="2026-11-02" /></Form.Item>
              <Form.Item name="endDate" label="截止日期" rules={editing ? [] : [{ required: true, message: '请填写截止日期' }]}><Input placeholder="2027-11-01" /></Form.Item>
              <Form.Item name="cityCode" label="城市代码"><Input placeholder="SH" /></Form.Item>
            </>
          )}
          <Form.Item name="status" label="状态">
            <Select options={CONTRACT_FORM_STATUSES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          </FormColumnLayout>
          {net && (
            <>
              <div style={{ fontWeight: 600, margin: '4px 0 8px' }}>甲方经办人</div>
              <FormColumnLayout>
                <Form.Item name="agentName" label="姓名" rules={[{ required: true, message: '请填写经办人姓名' }]}><Input /></Form.Item>
                <Form.Item name="agentIdNo" label="身份证号" rules={ID_RULE}><Input maxLength={18} /></Form.Item>
                <Form.Item name="agentTitle" label="职务" rules={[{ required: true, message: '请填写经办人职务' }]}><Input /></Form.Item>
                <Form.Item name="agentPhone" label="电话" rules={PHONE_RULE}><Input maxLength={11} /></Form.Item>
                <Form.Item name="agentEmail" label="邮箱" rules={[{ required: true, type: 'email', message: '请填写经办人邮箱' }]}><Input /></Form.Item>
                <Form.Item name="agentAddress" label="联系地址" rules={[{ required: true, message: '请填写经办人联系地址' }]}><Input /></Form.Item>
              </FormColumnLayout>
              <div style={{ fontWeight: 600, margin: '4px 0 8px' }}>附件2 销售订单</div>
              <FormColumnLayout>
                <Form.Item name="partyAddress" label="甲方地址" rules={[{ required: true, message: '请填写甲方地址' }]}><Input /></Form.Item>
                <Form.Item name="partyBank" label="开户行" rules={[{ required: true, message: '请填写甲方开户行' }]}><Input /></Form.Item>
                <Form.Item name="partyAccount" label="账号" rules={[{ required: true, message: '请填写甲方账号' }]}><Input /></Form.Item>
              </FormColumnLayout>
              <Form.List name="orderLines">
                {(fields, { add, remove }) => (
                  <div>
                    {fields.map((field, index) => (
                      <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 0.8fr 1.3fr auto', gap: 8, alignItems: 'start' }}>
                        <Form.Item name={[field.name, 'mallName']} label={index === 0 ? '商场名称' : ''} rules={[{ required: true, message: '请填写商场名称' }]}><Input /></Form.Item>
                        <Form.Item name={[field.name, 'deviceType']} label={index === 0 ? '设备类型' : ''} rules={[{ required: true, message: '请填写设备类型' }]}><Input /></Form.Item>
                        <Form.Item name={[field.name, 'deviceModel']} label={index === 0 ? '设备型号' : ''} rules={[{ required: true, message: '请填写设备型号' }]}><Input /></Form.Item>
                        <Form.Item name={[field.name, 'unitPrice']} label={index === 0 ? '单价（元/年）' : ''} rules={[{ required: true, message: '请填写单价' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                        <Form.Item name={[field.name, 'contractDate']} label={index === 0 ? '合同日期' : ''} rules={[{ required: true, message: '请填写合同日期' }]}><Input /></Form.Item>
                        <Button type="link" danger disabled={fields.length === 1} style={{ marginTop: index === 0 ? 30 : 0 }} onClick={() => remove(field.name)}>删除</Button>
                      </div>
                    ))}
                    <Button type="dashed" onClick={() => add(blankOrderLine(form.getFieldValue('storeName'), form.getFieldValue('signDate')))}>添加明细</Button>
                    <div style={{ marginTop: 8 }}>合计金额：{formatMoney(orderTotal)}（按明细单价自动汇总）</div>
                  </div>
                )}
              </Form.List>
              <div style={{ fontWeight: 600, margin: '12px 0 8px' }}>附件3 合作人</div>
              <FormColumnLayout>
                <Form.Item name="partnerName" label="合作人姓名" rules={[{ required: true, message: '请填写合作人姓名' }]}><Input /></Form.Item>
                <Form.Item name="partnerIdNo" label="身份证号" rules={ID_RULE}><Input maxLength={18} /></Form.Item>
                <Form.Item name="partnerPhone" label="联系电话" rules={PHONE_RULE}><Input maxLength={11} /></Form.Item>
                <Form.Item name="partnerSignDate" label="签署日期" rules={[{ required: true, message: '请填写附件3签署日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
              </FormColumnLayout>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title={`合同详情 — ${detail?.contractNo}`}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={detail?.docPath ? [
          <Button key="preview" onClick={() => openPreview(detail)}>预览</Button>,
          <Button key="down" type="primary" icon={<DownloadOutlined />} onClick={() => handleDownload(detail)}>下载</Button>,
        ] : null}
        width={detail?.templateKey === NET_TEMPLATE ? 720 : 560}
      >
        {detail && (
          <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="合同编号">{detail.contractNo}</Descriptions.Item>
            <Descriptions.Item label="合同模板">{templateLabel(detail.templateKey)}</Descriptions.Item>
            <Descriptions.Item label="工单号">{detail.orderNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="店名">{detail.storeName || '-'}</Descriptions.Item>
            <Descriptions.Item label="公司名称">{detail.customerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="签署人">{detail.signerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="手机号">{detail.signerPhone || '-'}</Descriptions.Item>
            <Descriptions.Item label="身份证号">{detail.signerIdNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="签署日期">{detail.signDate || '-'}</Descriptions.Item>
            <Descriptions.Item label="门店">{detail.storeName}</Descriptions.Item>
            <Descriptions.Item label="套餐">{detail.productType || detail.package || '-'}</Descriptions.Item>
            <Descriptions.Item label="售价金额">{formatMoney(detail.amount)}</Descriptions.Item>
            <Descriptions.Item label="起始">{detail.startDate}</Descriptions.Item>
            <Descriptions.Item label="截止">{detail.endDate}</Descriptions.Item>
            <Descriptions.Item label="城市代码">{detail.cityCode}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColor[detail.status]}>{detail.status}</Tag></Descriptions.Item>
            {detail.templateKey === NET_TEMPLATE && (
              <>
                <Descriptions.Item label="销售">{detail.salesName || '-'} {detail.salesPhone || ''}</Descriptions.Item>
                <Descriptions.Item label="设备金额">{formatMoney(detail.deviceAmount)} {detail.deviceAmountUpper ? `（${detail.deviceAmountUpper}）` : ''}</Descriptions.Item>
                <Descriptions.Item label="经办人" span={2}>{[detail.agentName, detail.agentTitle, detail.agentPhone, detail.agentEmail].filter(Boolean).join(' / ') || '-'}</Descriptions.Item>
                <Descriptions.Item label="订单明细" span={2}>{detail.orderSummary || '-'}</Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={preview?.title || '合同预览'}
        open={!!preview}
        onCancel={() => setPreview(null)}
        width={860}
        styles={{ body: { maxHeight: '72vh', overflow: 'auto' } }}
        footer={[
          <Button key="close" onClick={() => setPreview(null)}>关闭</Button>,
          <Button key="down" type="primary" icon={<DownloadOutlined />} onClick={() => preview && handleDownload(preview)}>下载 Word</Button>,
        ]}
      >
        <style>{`.net-contract h2{text-align:center;margin:0 0 12px}.net-contract h3{margin:18px 0 8px}.net-contract p{margin:6px 0;line-height:1.75}.net-contract table{width:100%;border-collapse:collapse;margin:8px 0}.net-contract td{border:1px solid #d9d9d9;padding:4px 8px;vertical-align:top}`}</style>
        <div dangerouslySetInnerHTML={{ __html: preview?.html || '' }} />
      </Modal>

      <ContractPrint contract={printContract} onClose={() => setPrintContract(null)} />
    </div>
  )
}
