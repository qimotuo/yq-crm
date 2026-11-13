import { useEffect, useState, useMemo } from 'react'
import { Table, Tabs, Tag, Alert, Button, Modal, Form, Select, Input, message, Space, Popconfirm, Upload, InputNumber, Checkbox, DatePicker } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getStockIn, getSimStockIn, getStockOut, createStockOut,
  createStockIn, updateStockIn, deleteStockIn, importStockIn,
  createSimStockIn, updateSimStockIn, deleteSimStockIn, importSimStockIn,
  importStockOut, getStockConfig, updateStockConfig,
} from '../api'
import { getWorkOrders } from '../api/workOrder'
import { Permission } from '../components/RequireAuth'
import ExportButton from '../components/ExportButton'
import { ListToolbar, FilterInput, FilterSelect, QueryButton, ResetButton } from '../components/ListToolbar'
import { useAuth } from '../hooks/useAuth'
import { runClientQuery } from '../utils/listLoad'
import FormColumnLayout, { modalFormWidth } from '../components/FormColumnLayout'
import { downloadCsvTemplate, parseImportFile, IMPORT_ACCEPT } from '../utils/csvImport'
import { useTablePagination } from '../hooks/useTablePagination'

const DEVICE_TEMPLATE = {
  filename: '设备入库导入模板.csv',
  headers: ['入库日期', '供应商', '设备型号', 'IMEI', 'MAC', '数量', '领用人', '备注', '店名', '关联工单', '移动卡号', '电信卡号', '已更换旧卡号'],
  keys: ['inDate', 'supplier', 'model', 'imei', 'mac', 'qty', 'receiver', 'remark', 'storeName', 'orderNo', 'mobileNo', 'telecomNo', 'replacedCardNo'],
  sample: ['2026-10-27 10:30:00', '鲲鹏', '鲲鹏618', '865432041234567', 'AA:BB:CC:DD:EE:01', '10', '张三', '首批试点', '华为正企', 'GD-20261025-088', '13800001111', '18900002222', ''],
  required: ['supplier', 'model', 'imei', 'mac'],
  optional: ['店名', '关联工单', '移动卡号', '电信卡号', '已更换旧卡号'],
}

const SIM_TEMPLATE = {
  filename: 'SIM卡入库导入模板.csv',
  headers: ['入库日期', '供应商', '运营商', 'ICCID', '数量', '领用人', '备注'],
  keys: ['inDate', 'supplier', 'operator', 'iccid', 'qty', 'receiver', 'remark'],
  sample: ['2026-10-27 10:30:00', '鲲鹏', '中国移动', '89860123456789012345', '10', '张三', '首批试点'],
  required: ['operator', 'iccid'],
}

const OUT_TEMPLATE = {
  filename: '设备出库导入模板.csv',
  headers: ['出库日期', '工单号', '设备型号', 'IMEI', 'MAC', 'ICCID', 'ICCID2', '运营商', '领用人', '备注', '店名', '移动卡号', '电信卡号', '已更换旧卡号'],
  keys: ['outDate', 'orderNo', 'model', 'imei', 'mac', 'iccid', 'iccid2', 'operator', 'receiver', 'remark', 'storeName', 'mobileNo', 'telecomNo', 'replacedCardNo'],
  sample: ['2026-10-27 14:00:00', 'GD-20261025-088', '鲲鹏618', '865432041234567', 'AA:BB:CC:DD:EE:01', '89860123456789012345', '89860123456789012346', '中国移动', '张三', '首批试点安装', '华为正企', '13800001111', '18900002222', '13700003333'],
  required: ['orderNo', 'model', 'mac'],
  optional: ['店名', '移动卡号', '电信卡号', '已更换旧卡号'],
}

const OPERATORS = ['中国移动', '中国电信', '中国联通']

const STOCK_DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss'

function nowStockDatetime() {
  return dayjs().format(STOCK_DATETIME_FMT)
}

function toStockDayjs(value) {
  if (!value) return null
  if (dayjs.isDayjs(value)) return value
  const d = dayjs(value)
  return d.isValid() ? d : null
}

function formatStockDatetime(value) {
  if (!value) return nowStockDatetime()
  if (dayjs.isDayjs(value)) return value.format(STOCK_DATETIME_FMT)
  const text = String(value).trim()
  if (text.length <= 10) return `${text} 00:00:00`
  const d = dayjs(text)
  return d.isValid() ? d.format(STOCK_DATETIME_FMT) : text
}

const stockDateTimePickerProps = {
  showTime: { format: 'HH:mm:ss' },
  format: STOCK_DATETIME_FMT,
  style: { width: '100%' },
  needConfirm: false,
}

const EMPTY_IN_QUERY = { keyword: '', supplier: '', storeName: '', orderNo: '', lowStock: false, dateRange: null }
const EMPTY_SIM_QUERY = { keyword: '', operator: '', lowStock: false, dateRange: null }
const EMPTY_OUT_QUERY = { keyword: '', operator: '', storeName: '', orderNo: '', dateRange: null }

function fuzzyMatch(row, keyword, fields) {
  if (!keyword?.trim()) return true
  const kw = keyword.trim().toLowerCase()
  return fields.some((f) => String(row[f] ?? '').toLowerCase().includes(kw))
}

function uniqueOptions(list, key) {
  return [...new Set(list.map((i) => i[key]).filter(Boolean))].map((v) => ({ value: v, label: v }))
}

function matchDateRange(dateStr, range) {
  if (!range?.[0] || !range?.[1]) return true
  if (!dateStr) return false
  const d = String(dateStr).slice(0, 10)
  const start = range[0].format('YYYY-MM-DD')
  const end = range[1].format('YYYY-MM-DD')
  return d >= start && d <= end
}

function ImportActions({ addPermission, importPermission, exportPermission, template, onImport, addLabel, onAdd, exportFilename, exportData, exportColumns }) {
  return (
    <>
      <Permission code={addPermission}>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>{addLabel}</Button>
      </Permission>
      <Permission code={importPermission}>
        <Button icon={<DownloadOutlined />} onClick={() => downloadCsvTemplate(template)}>下载模板</Button>
        <Upload showUploadList={false} accept={IMPORT_ACCEPT} beforeUpload={onImport}>
          <Button icon={<UploadOutlined />}>批量导入</Button>
        </Upload>
      </Permission>
      <Permission code={exportPermission}>
        <ExportButton filename={exportFilename} data={exportData} columns={exportColumns} />
      </Permission>
    </>
  )
}

export default function StockList() {
  const [loading, setLoading] = useState(true)
  const [inData, setInData] = useState([])
  const [simData, setSimData] = useState([])
  const [outData, setOutData] = useState([])
  const [outModalOpen, setOutModalOpen] = useState(false)
  const [inModalOpen, setInModalOpen] = useState(false)
  const [simModalOpen, setSimModalOpen] = useState(false)
  const [currentIn, setCurrentIn] = useState(null)
  const [currentSim, setCurrentSim] = useState(null)
  const [orders, setOrders] = useState([])
  const [outForm] = Form.useForm()
  const [inForm] = Form.useForm()
  const [simForm] = Form.useForm()
  const [inFilters, setInFilters] = useState(EMPTY_IN_QUERY)
  const [inQuery, setInQuery] = useState(EMPTY_IN_QUERY)
  const [simFilters, setSimFilters] = useState(EMPTY_SIM_QUERY)
  const [simQuery, setSimQuery] = useState(EMPTY_SIM_QUERY)
  const [outFilters, setOutFilters] = useState(EMPTY_OUT_QUERY)
  const [outQuery, setOutQuery] = useState(EMPTY_OUT_QUERY)
  const [lowThreshold, setLowThreshold] = useState(5)
  const [thrSaving, setThrSaving] = useState(false)
  const { user } = useAuth()

  const load = () => {
    setLoading(true)
    Promise.all([getStockIn(), getSimStockIn(), getStockOut(), getStockConfig().catch(() => ({ lowThreshold: 5 }))])
      .then(([inRes, simRes, outRes, cfg]) => {
        setInData(inRes.list)
        setSimData(simRes.list)
        setOutData(outRes.list)
        const thr = Number(inRes.lowThreshold ?? simRes.lowThreshold ?? cfg?.lowThreshold ?? 5)
        setLowThreshold(Number.isFinite(thr) ? thr : 5)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(); getWorkOrders({}).then((r) => setOrders(r.list)) }, [])

  const lowStock = simData.filter((s) => s.stockQty <= lowThreshold)
  const lowDeviceStock = inData.filter((s) => s.stockQty <= lowThreshold)

  const filteredInData = useMemo(() => inData.filter((row) => {
    if (!matchDateRange(row.inDate, inQuery.dateRange)) return false
    if (inQuery.supplier && row.supplier !== inQuery.supplier) return false
    if (inQuery.storeName && row.storeName !== inQuery.storeName) return false
    if (inQuery.orderNo && row.orderNo !== inQuery.orderNo) return false
    if (inQuery.lowStock && row.stockQty > lowThreshold) return false
    return fuzzyMatch(row, inQuery.keyword, ['inNo', 'supplier', 'model', 'imei', 'mac', 'receiver', 'remark', 'storeName', 'orderNo', 'mobileNo', 'telecomNo', 'replacedCardNo'])
  }), [inData, inQuery, lowThreshold])

  const filteredSimData = useMemo(() => simData.filter((row) => {
    if (!matchDateRange(row.inDate, simQuery.dateRange)) return false
    if (simQuery.operator && row.operator !== simQuery.operator) return false
    if (simQuery.lowStock && row.stockQty > lowThreshold) return false
    return fuzzyMatch(row, simQuery.keyword, ['inNo', 'supplier', 'operator', 'iccid', 'receiver', 'remark'])
  }), [simData, simQuery, lowThreshold])

  const filteredOutData = useMemo(() => outData.filter((row) => {
    if (!matchDateRange(row.outDate, outQuery.dateRange)) return false
    if (outQuery.operator && row.operator !== outQuery.operator) return false
    if (outQuery.storeName && row.storeName !== outQuery.storeName) return false
    if (outQuery.orderNo && row.orderNo !== outQuery.orderNo) return false
    return fuzzyMatch(row, outQuery.keyword, ['outNo', 'orderNo', 'storeName', 'customerName', 'model', 'imei', 'mac', 'iccid', 'iccid2', 'receiver', 'remark', 'mobileNo', 'telecomNo', 'replacedCardNo'])
  }), [outData, outQuery])
  const inPagination = useTablePagination(10, filteredInData.length).pagination
  const simPagination = useTablePagination(10, filteredSimData.length).pagination
  const outPagination = useTablePagination(10, filteredOutData.length).pagination

  const inSupplierOptions = useMemo(() => uniqueOptions(inData, 'supplier'), [inData])
  const inStoreOptions = useMemo(() => uniqueOptions(inData, 'storeName'), [inData])
  const inOrderOptions = useMemo(() => uniqueOptions(inData, 'orderNo'), [inData])
  const outStoreOptions = useMemo(() => uniqueOptions(outData, 'storeName'), [outData])
  const outOrderOptions = useMemo(() => uniqueOptions(outData, 'orderNo'), [outData])
  const orderOptions = useMemo(() => orders.map((o) => ({
    value: o.orderNo,
    label: [o.orderNo, o.storeName, o.customerName].filter(Boolean).join(' · '),
  })), [orders])

  const fillStoreByOrder = (form, orderNo) => {
    const order = orders.find((o) => o.orderNo === orderNo)
    if (!order) return
    form.setFieldsValue({
      storeName: order.storeName || '',
      customerName: order.customerName || '',
      address: order.address || '',
    })
  }

  const defaultInValues = () => ({
    inDate: dayjs(),
    supplier: '',
    model: '',
    imei: '',
    mac: '',
    qty: 1,
    receiver: user?.name || '',
    remark: '',
    storeName: '',
    orderNo: undefined,
    mobileNo: '',
    telecomNo: '',
    replacedCardNo: '',
  })

  const defaultSimValues = () => ({
    inDate: dayjs(),
    supplier: '',
    operator: undefined,
    iccid: '',
    qty: 1,
    receiver: user?.name || '',
    remark: '',
  })

  const openOut = () => {
    setOutModalOpen(true)
  }

  const closeOutModal = () => {
    setOutModalOpen(false)
    outForm.resetFields()
  }

  const handleOut = async () => {
    const values = await outForm.validateFields()
    const order = orders.find((o) => o.orderNo === values.orderNo)
    await createStockOut({
      ...values,
      outDate: formatStockDatetime(values.outDate),
      storeName: values.storeName || order?.storeName || '',
      customerName: values.customerName || order?.customerName || '',
      address: values.address || order?.address || '',
      receiver: values.receiver || user.name || '张三',
    })
    message.success('出库成功，库存已扣减')
    closeOutModal()
    load()
  }

  const handleOutImport = async (file) => {
    try {
      const rows = await parseImportFile(file, OUT_TEMPLATE)
      const res = await importStockOut(rows)
      message.success(`成功导入 ${res.count} 条出库记录`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const openInEdit = (record) => {
    setCurrentIn(record)
    setInModalOpen(true)
  }

  const fillInForm = (record) => {
    if (record?.id) {
      inForm.setFieldsValue({ ...record, inDate: toStockDayjs(record.inDate) || dayjs(), orderNo: record.orderNo || undefined })
    } else {
      inForm.resetFields()
      inForm.setFieldsValue(defaultInValues())
    }
  }

  const closeInModal = () => {
    setInModalOpen(false)
    setCurrentIn(null)
    inForm.resetFields()
  }

  const handleInSave = async () => {
    const values = await inForm.validateFields()
    const payload = { ...values, inDate: formatStockDatetime(values.inDate) }
    if (currentIn?.id) {
      await updateStockIn({ ...currentIn, ...payload })
      message.success('设备入库已更新')
    } else {
      await createStockIn({ ...payload, receiver: payload.receiver || user.name })
      message.success('设备入库已新增')
    }
    closeInModal()
    load()
  }

  const handleInDelete = async (id) => {
    await deleteStockIn(id)
    message.success('已删除')
    load()
  }

  const handleInImport = async (file) => {
    try {
      const rows = await parseImportFile(file, DEVICE_TEMPLATE)
      const res = await importStockIn(rows)
      message.success(`成功导入 ${res.count} 条设备入库记录`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const openSimEdit = (record) => {
    setCurrentSim(record)
    setSimModalOpen(true)
  }

  const fillSimForm = (record) => {
    if (record?.id) {
      simForm.setFieldsValue({ ...record, inDate: toStockDayjs(record.inDate) || dayjs() })
    } else {
      simForm.resetFields()
      simForm.setFieldsValue(defaultSimValues())
    }
  }

  const closeSimModal = () => {
    setSimModalOpen(false)
    setCurrentSim(null)
    simForm.resetFields()
  }

  const handleSimSave = async () => {
    const values = await simForm.validateFields()
    const payload = { ...values, inDate: formatStockDatetime(values.inDate) }
    if (currentSim?.id) {
      await updateSimStockIn({ ...currentSim, ...payload })
      message.success('SIM 卡入库已更新')
    } else {
      await createSimStockIn({ ...payload, receiver: payload.receiver || user.name })
      message.success('SIM 卡入库已新增')
    }
    closeSimModal()
    load()
  }

  const handleSimDelete = async (id) => {
    await deleteSimStockIn(id)
    message.success('已删除')
    load()
  }

  const handleSimImport = async (file) => {
    try {
      const rows = await parseImportFile(file, SIM_TEMPLATE)
      const res = await importSimStockIn(rows)
      message.success(`成功导入 ${res.count} 条 SIM 卡入库记录`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const actionCol = (onEdit, onDelete, editCode, deleteCode) => ({
    title: '操作', width: 130, fixed: 'right',
    render: (_, r) => (
      <Space size={0}>
        <Permission code={editCode}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(r)}>编辑</Button>
        </Permission>
        <Permission code={deleteCode}>
          <Popconfirm title="确认删除该入库记录？" onConfirm={() => onDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Permission>
      </Space>
    ),
  })

  const inColumns = [
    { title: '入库单号', dataIndex: 'inNo', width: 150 },
    { title: '入库时间', dataIndex: 'inDate', width: 170 },
    { title: '供应商', dataIndex: 'supplier', width: 80 },
    { title: '设备型号', dataIndex: 'model', width: 100 },
    { title: '店名', dataIndex: 'storeName', width: 120, render: (v) => v || '-' },
    { title: '关联工单', dataIndex: 'orderNo', width: 160, render: (v) => v || '-' },
    { title: 'IMEI', dataIndex: 'imei', width: 150 },
    { title: 'MAC', dataIndex: 'mac', width: 150 },
    { title: '移动卡号', dataIndex: 'mobileNo', width: 130, render: (v) => v || '-' },
    { title: '电信卡号', dataIndex: 'telecomNo', width: 130, render: (v) => v || '-' },
    { title: '已更换旧卡号', dataIndex: 'replacedCardNo', width: 140, render: (v) => v || '-' },
    { title: '数量', dataIndex: 'qty', width: 60 },
    { title: '仓库剩余数量', dataIndex: 'stockQty', width: 110, render: (v) => v <= lowThreshold ? <Tag color="error">{v}</Tag> : v },
    { title: '领用人', dataIndex: 'receiver', width: 80 },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    actionCol(openInEdit, handleInDelete, 'stock:in:edit', 'stock:in:delete'),
  ]

  const simColumns = [
    { title: '入库单号', dataIndex: 'inNo', width: 150 },
    { title: '入库时间', dataIndex: 'inDate', width: 170 },
    { title: '运营商', dataIndex: 'operator', width: 100 },
    { title: 'ICCID', dataIndex: 'iccid', width: 200 },
    { title: '数量', dataIndex: 'qty', width: 60 },
    { title: '库存余量', dataIndex: 'stockQty', width: 90, render: (v) => v <= lowThreshold ? <Tag color="error">{v} ⚠️</Tag> : v },
    { title: '领用人', dataIndex: 'receiver', width: 80 },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    actionCol(openSimEdit, handleSimDelete, 'stock:sim:edit', 'stock:sim:delete'),
  ]

  const outColumns = [
    { title: '出库单号', dataIndex: 'outNo', width: 150 },
    { title: '出库时间', dataIndex: 'outDate', width: 170 },
    { title: '工单号', dataIndex: 'orderNo', width: 160 },
    { title: '店名', dataIndex: 'storeName', width: 120, render: (v) => v || '-' },
    { title: '设备型号', dataIndex: 'model', width: 100 },
    { title: 'MAC', dataIndex: 'mac', width: 150 },
    { title: '移动卡号', dataIndex: 'mobileNo', width: 130, render: (v) => v || '-' },
    { title: '电信卡号', dataIndex: 'telecomNo', width: 130, render: (v) => v || '-' },
    { title: '已更换旧卡号', dataIndex: 'replacedCardNo', width: 140, render: (v) => v || '-' },
    { title: 'ICCID', dataIndex: 'iccid', width: 180 },
    { title: 'ICCID2', dataIndex: 'iccid2', width: 180, render: (v) => v || '-' },
    { title: '运营商', dataIndex: 'operator', width: 100 },
    { title: '领用人', dataIndex: 'receiver', width: 80 },
  ]

  const applyInFilters = (patch) => {
    setInFilters((f) => {
      const next = { ...f, ...patch }
      runClientQuery(setLoading, () => setInQuery(next))
      return next
    })
  }

  const applySimFilters = (patch) => {
    setSimFilters((f) => {
      const next = { ...f, ...patch }
      runClientQuery(setLoading, () => setSimQuery(next))
      return next
    })
  }

  const applyOutFilters = (patch) => {
    setOutFilters((f) => {
      const next = { ...f, ...patch }
      runClientQuery(setLoading, () => setOutQuery(next))
      return next
    })
  }

  const inToolbar = (
    <ListToolbar
      filters={(
        <>
          <FilterInput
            placeholder="搜索单号/店名/工单/型号/IMEI/MAC/卡号"
            value={inFilters.keyword}
            onChange={(e) => setInFilters((f) => ({ ...f, keyword: e.target.value }))}
            onPressEnter={() => setInQuery({ ...inFilters })}
          />
          <FilterSelect
            placeholder="供应商"
            value={inFilters.supplier || undefined}
            onChange={(v) => applyInFilters({ supplier: v || '' })}
            options={inSupplierOptions}
          />
          <FilterSelect
            placeholder="店名"
            showSearch
            optionFilterProp="label"
            value={inFilters.storeName || undefined}
            onChange={(v) => applyInFilters({ storeName: v || '' })}
            options={inStoreOptions}
          />
          <FilterSelect
            placeholder="关联工单"
            showSearch
            optionFilterProp="label"
            value={inFilters.orderNo || undefined}
            onChange={(v) => applyInFilters({ orderNo: v || '' })}
            options={inOrderOptions}
          />
          <DatePicker.RangePicker
            className="stock-filter-date"
            value={inFilters.dateRange}
            onChange={(v) => setInFilters((f) => ({ ...f, dateRange: v }))}
            placeholder={['开始日期', '结束日期']}
            allowClear
          />
          <Checkbox
            checked={inFilters.lowStock}
            onChange={(e) => {
              const checked = e.target.checked
              setInFilters((f) => ({ ...f, lowStock: checked }))
              setInQuery((q) => ({ ...q, lowStock: checked }))
            }}
          >低库存</Checkbox>
          <QueryButton loading={loading} onClick={() => runClientQuery(setLoading, () => setInQuery({ ...inFilters }))} />
          <ResetButton onClick={() => { setInFilters({ ...EMPTY_IN_QUERY }); setInQuery({ ...EMPTY_IN_QUERY }) }} />
        </>
      )}
      actions={(
        <ImportActions
          addPermission="stock:in"
          importPermission="stock:in:import"
          exportPermission="stock:in:export"
          template={DEVICE_TEMPLATE}
          onImport={handleInImport}
          addLabel="新增入库"
          onAdd={() => openInEdit(null)}
          exportFilename="stock-in.csv"
          exportData={filteredInData}
          exportColumns={inColumns}
        />
      )}
    />
  )

  const simToolbar = (
    <ListToolbar
      filters={(
        <>
          <FilterInput
            placeholder="搜索单号/ICCID/运营商/供应商"
            value={simFilters.keyword}
            onChange={(e) => setSimFilters((f) => ({ ...f, keyword: e.target.value }))}
            onPressEnter={() => setSimQuery({ ...simFilters })}
          />
          <FilterSelect
            placeholder="运营商"
            value={simFilters.operator || undefined}
            onChange={(v) => applySimFilters({ operator: v || '' })}
            options={OPERATORS.map((v) => ({ value: v, label: v }))}
          />
          <DatePicker.RangePicker
            className="stock-filter-date"
            value={simFilters.dateRange}
            onChange={(v) => setSimFilters((f) => ({ ...f, dateRange: v }))}
            placeholder={['开始日期', '结束日期']}
            allowClear
          />
          <Checkbox
            checked={simFilters.lowStock}
            onChange={(e) => {
              const checked = e.target.checked
              setSimFilters((f) => ({ ...f, lowStock: checked }))
              setSimQuery((q) => ({ ...q, lowStock: checked }))
            }}
          >低库存</Checkbox>
          <QueryButton loading={loading} onClick={() => runClientQuery(setLoading, () => setSimQuery({ ...simFilters }))} />
          <ResetButton onClick={() => { setSimFilters({ ...EMPTY_SIM_QUERY }); setSimQuery({ ...EMPTY_SIM_QUERY }) }} />
        </>
      )}
      actions={(
        <ImportActions
          addPermission="stock:sim"
          importPermission="stock:sim:import"
          exportPermission="stock:sim:export"
          template={SIM_TEMPLATE}
          onImport={handleSimImport}
          addLabel="新增入库"
          onAdd={() => openSimEdit(null)}
          exportFilename="sim-stock-in.csv"
          exportData={filteredSimData}
          exportColumns={simColumns}
        />
      )}
    />
  )

  const outToolbar = (
    <ListToolbar
      filters={(
        <>
          <FilterInput
            placeholder="搜索单号/工单/店名/客户/MAC/卡号"
            value={outFilters.keyword}
            onChange={(e) => setOutFilters((f) => ({ ...f, keyword: e.target.value }))}
            onPressEnter={() => setOutQuery({ ...outFilters })}
          />
          <FilterSelect
            placeholder="店名"
            showSearch
            optionFilterProp="label"
            value={outFilters.storeName || undefined}
            onChange={(v) => applyOutFilters({ storeName: v || '' })}
            options={outStoreOptions}
          />
          <FilterSelect
            placeholder="关联工单"
            showSearch
            optionFilterProp="label"
            value={outFilters.orderNo || undefined}
            onChange={(v) => applyOutFilters({ orderNo: v || '' })}
            options={outOrderOptions}
          />
          <FilterSelect
            placeholder="运营商"
            value={outFilters.operator || undefined}
            onChange={(v) => applyOutFilters({ operator: v || '' })}
            options={OPERATORS.map((v) => ({ value: v, label: v }))}
          />
          <DatePicker.RangePicker
            className="stock-filter-date"
            value={outFilters.dateRange}
            onChange={(v) => setOutFilters((f) => ({ ...f, dateRange: v }))}
            placeholder={['开始日期', '结束日期']}
            allowClear
          />
          <QueryButton loading={loading} onClick={() => runClientQuery(setLoading, () => setOutQuery({ ...outFilters }))} />
          <ResetButton onClick={() => { setOutFilters({ ...EMPTY_OUT_QUERY }); setOutQuery({ ...EMPTY_OUT_QUERY }) }} />
        </>
      )}
      actions={(
        <ImportActions
          addPermission="stock:out"
          importPermission="stock:out:import"
          exportPermission="stock:out:export"
          template={OUT_TEMPLATE}
          onImport={handleOutImport}
          addLabel="新增出库"
          onAdd={openOut}
          exportFilename="stock-out.csv"
          exportData={filteredOutData}
          exportColumns={outColumns}
        />
      )}
    />
  )

  const items = [
    {
      key: 'in', label: '设备入库',
      children: (
        <>
          {inToolbar}
          <Table columns={inColumns} dataSource={filteredInData} rowKey="id" loading={loading} scroll={{ x: 2100 }} pagination={{ ...inPagination, showTotal: (t) => `共 ${t} 条` }} />
        </>
      ),
    },
    {
      key: 'sim',
      label: <span>SIM 卡入库 {lowStock.length > 0 && <Tag color="error">{lowStock.length} 项预警</Tag>}</span>,
      children: (
        <>
          {lowStock.length > 0 && <Alert type="warning" message={`${lowStock.length} 项 SIM 卡库存低于阈值（≤${lowThreshold}）`} style={{ marginBottom: 16 }} showIcon />}
          {simToolbar}
          <Table columns={simColumns} dataSource={filteredSimData} rowKey="id" loading={loading} scroll={{ x: 1100 }} pagination={{ ...simPagination, showTotal: (t) => `共 ${t} 条` }} />
        </>
      ),
    },
    { key: 'out', label: '设备出库', children: (
      <>
        {outToolbar}
        <Table columns={outColumns} dataSource={filteredOutData} rowKey="id" loading={loading} scroll={{ x: 2100 }} pagination={{ ...outPagination, showTotal: (t) => `共 ${t} 条` }} />
      </>
    ) },
  ]

  const saveThreshold = async (value) => {
    const thr = Number(value)
    if (!Number.isFinite(thr) || thr < 0) {
      message.error('阈值需为非负整数')
      return
    }
    setThrSaving(true)
    try {
      const data = await updateStockConfig({ lowThreshold: thr })
      setLowThreshold(data.lowThreshold)
      message.success(`预警阈值已更新为 ≤${data.lowThreshold}`)
    } catch (e) {
      message.error(e.message || '保存失败')
    } finally {
      setThrSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2>设备出入库</h2>
          <p>入库、出库关联工单，库存自动扣减
            {(lowDeviceStock.length + lowStock.length) > 0 && (
              <Tag color="error" style={{ marginLeft: 8 }}>
                设备 {lowDeviceStock.length} / SIM {lowStock.length} 项低于 ≤{lowThreshold}
              </Tag>
            )}
          </p>
        </div>
        <Permission code="stock:config">
          <Space>
            <span style={{ color: '#666' }}>预警阈值</span>
            <InputNumber
              min={0}
              max={9999}
              value={lowThreshold}
              disabled={thrSaving}
              onChange={(v) => setLowThreshold(v ?? 0)}
              onPressEnter={() => saveThreshold(lowThreshold)}
            />
            <Button loading={thrSaving} onClick={() => saveThreshold(lowThreshold)}>保存</Button>
          </Space>
        </Permission>
      </div>
      <Tabs items={items} />

      <Modal
        title="新增出库单"
        open={outModalOpen}
        onOk={handleOut}
        onCancel={closeOutModal}
        width={modalFormWidth(12)}
        destroyOnClose
        afterOpenChange={(opened) => {
          if (!opened) return
          outForm.resetFields()
          outForm.setFieldsValue({ outDate: dayjs() })
        }}
      >
        <Form form={outForm} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
          <FormColumnLayout>
          <Form.Item name="outDate" label="出库时间" rules={[{ required: true }]}>
            <DatePicker {...stockDateTimePickerProps} placeholder="选择出库时间" />
          </Form.Item>
          <Form.Item name="orderNo" label="关联工单" rules={[{ required: true }]}>
            <Select
              placeholder="按工单号/店名搜索"
              showSearch
              optionFilterProp="label"
              options={orderOptions}
              onChange={(orderNo) => fillStoreByOrder(outForm, orderNo)}
            />
          </Form.Item>
          <Form.Item name="storeName" label="店名"><Input placeholder="选择工单后自动带出，可改" /></Form.Item>
          <Form.Item name="model" label="设备型号" rules={[{ required: true }]}><Input placeholder="鲲鹏618" /></Form.Item>
          <Form.Item name="mac" label="MAC" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="imei" label="IMEI"><Input /></Form.Item>
          <Form.Item name="mobileNo" label="移动卡号"><Input placeholder="中国移动卡号" /></Form.Item>
          <Form.Item name="telecomNo" label="电信卡号"><Input placeholder="中国电信卡号" /></Form.Item>
          <Form.Item name="replacedCardNo" label="已更换旧卡号"><Input placeholder="换卡前的旧卡号" /></Form.Item>
          <Form.Item name="iccid" label="ICCID"><Input /></Form.Item>
          <Form.Item name="iccid2" label="ICCID2"><Input /></Form.Item>
          <Form.Item name="operator" label="运营商">
            <Select options={OPERATORS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
          </FormColumnLayout>
        </Form>
      </Modal>

      <Modal
        title={currentIn?.id ? '编辑设备入库' : '新增设备入库'}
        open={inModalOpen}
        onOk={handleInSave}
        onCancel={closeInModal}
        width={modalFormWidth(14)}
        destroyOnClose
        afterOpenChange={(opened) => { if (opened) fillInForm(currentIn) }}
      >
        <Form form={inForm} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
          <FormColumnLayout>
          {currentIn?.inNo && <Form.Item label="入库单号"><Input value={currentIn.inNo} disabled /></Form.Item>}
          <Form.Item name="inDate" label="入库时间" rules={[{ required: true }]}>
            <DatePicker {...stockDateTimePickerProps} placeholder="选择入库时间" />
          </Form.Item>
          <Form.Item name="supplier" label="供应商" rules={[{ required: true }]}><Input placeholder="鲲鹏、云软" /></Form.Item>
          <Form.Item name="model" label="设备型号" rules={[{ required: true }]}><Input placeholder="鲲鹏618" /></Form.Item>
          <Form.Item name="orderNo" label="关联工单">
            <Select
              allowClear
              placeholder="按工单号/店名搜索"
              showSearch
              optionFilterProp="label"
              options={orderOptions}
              onChange={(orderNo) => fillStoreByOrder(inForm, orderNo)}
            />
          </Form.Item>
          <Form.Item name="storeName" label="店名"><Input placeholder="选择工单后自动带出，可改" /></Form.Item>
          <Form.Item name="imei" label="IMEI" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="mac" label="MAC" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="mobileNo" label="移动卡号"><Input placeholder="中国移动卡号" /></Form.Item>
          <Form.Item name="telecomNo" label="电信卡号"><Input placeholder="中国电信卡号" /></Form.Item>
          <Form.Item name="replacedCardNo" label="已更换旧卡号"><Input placeholder="换卡前的旧卡号" /></Form.Item>
          <Form.Item name="qty" label="数量" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="receiver" label="领用人"><Input /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
          </FormColumnLayout>
        </Form>
      </Modal>

      <Modal
        title={currentSim?.id ? '编辑 SIM 卡入库' : '新增 SIM 卡入库'}
        open={simModalOpen}
        onOk={handleSimSave}
        onCancel={closeSimModal}
        width={modalFormWidth(7)}
        destroyOnClose
        afterOpenChange={(opened) => { if (opened) fillSimForm(currentSim) }}
      >
        <Form form={simForm} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
          <FormColumnLayout>
          {currentSim?.inNo && <Form.Item label="入库单号"><Input value={currentSim.inNo} disabled /></Form.Item>}
          <Form.Item name="inDate" label="入库时间" rules={[{ required: true }]}>
            <DatePicker {...stockDateTimePickerProps} placeholder="选择入库时间" />
          </Form.Item>
          <Form.Item name="supplier" label="供应商"><Input placeholder="鲲鹏、云软" /></Form.Item>
          <Form.Item name="operator" label="运营商" rules={[{ required: true }]}>
            <Select options={OPERATORS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="iccid" label="ICCID" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="qty" label="数量" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="receiver" label="领用人"><Input /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
          </FormColumnLayout>
        </Form>
      </Modal>
    </div>
  )
}
