import { useEffect, useState, useMemo } from 'react'
import { Table, Tabs, Tag, Alert, Button, Modal, Form, Select, Input, message, Space, Popconfirm, Upload, InputNumber, Checkbox, DatePicker } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getStockIn, getSimStockIn, getStockOut, createStockOut,
  createStockIn, updateStockIn, deleteStockIn, importStockIn,
  createSimStockIn, updateSimStockIn, deleteSimStockIn, importSimStockIn,
  importStockOut,
} from '../api'
import { getWorkOrders } from '../api/workOrder'
import { Permission } from '../components/RequireAuth'
import { ListToolbar, FilterInput, FilterSelect, QueryButton, ResetButton } from '../components/ListToolbar'
import { useAuth } from '../hooks/useAuth'
import { runClientQuery } from '../utils/listLoad'

const DEVICE_TEMPLATE = {
  filename: '设备入库导入模板.csv',
  headers: ['入库日期', '供应商', '设备型号', 'IMEI', 'MAC', '数量', '领用人', '备注'],
  keys: ['inDate', 'supplier', 'model', 'imei', 'mac', 'qty', 'receiver', 'remark'],
  sample: ['2026-10-27 10:30:00', '鲲鹏', '鲲鹏618', '865432041234567', 'AA:BB:CC:DD:EE:01', '10', '张三', '首批试点'],
  required: ['supplier', 'model', 'imei', 'mac'],
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
  headers: ['出库日期', '工单号', '设备型号', 'IMEI', 'MAC', 'ICCID', 'ICCID2', '运营商', '领用人', '备注'],
  keys: ['outDate', 'orderNo', 'model', 'imei', 'mac', 'iccid', 'iccid2', 'operator', 'receiver', 'remark'],
  sample: ['2026-10-27 14:00:00', 'GD-20261025-088', '鲲鹏618', '865432041234567', 'AA:BB:CC:DD:EE:01', '89860123456789012345', '89860123456789012346', '中国移动', '张三', '首批试点安装'],
  required: ['orderNo', 'model', 'mac'],
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

const EMPTY_IN_QUERY = { keyword: '', supplier: '', lowStock: false, dateRange: null }
const EMPTY_SIM_QUERY = { keyword: '', operator: '', lowStock: false, dateRange: null }
const EMPTY_OUT_QUERY = { keyword: '', operator: '', dateRange: null }

const TABLE_PAGE = { pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], showTotal: (t) => `共 ${t} 条` }

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

function ImportActions({ permission, template, onImport, addLabel, onAdd }) {
  return (
    <Permission code={permission}>
      <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>{addLabel}</Button>
      <Button icon={<DownloadOutlined />} onClick={() => downloadCsvTemplate(template)}>下载模板</Button>
      <Upload showUploadList={false} accept=".csv" beforeUpload={onImport}>
        <Button icon={<UploadOutlined />}>批量导入</Button>
      </Upload>
    </Permission>
  )
}

function downloadCsvTemplate(tpl) {
  const bom = '\uFEFF'
  const content = bom + [tpl.headers.join(','), tpl.sample.join(',')].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = tpl.filename
  a.click()
}

function parseCsvFile(text, tpl) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) throw new Error('文件无数据行，请使用模板填写后导入')
  const headers = lines[0].split(',').map((h) => h.trim())
  const missing = tpl.headers.filter((h) => !headers.includes(h))
  if (missing.length) throw new Error(`表头缺少列：${missing.join('、')}`)
  return lines.slice(1).map((line, idx) => {
    const cols = line.split(',').map((c) => c.trim())
    const row = {}
    tpl.headers.forEach((h, i) => {
      const key = tpl.keys[tpl.headers.indexOf(h)]
      row[key] = cols[i] || ''
    })
    const lacks = tpl.required.filter((k) => !row[k])
    if (lacks.length) throw new Error(`第 ${idx + 2} 行缺少必填：${lacks.join('、')}`)
    return row
  })
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
  const { user } = useAuth()

  const load = () => {
    setLoading(true)
    Promise.all([getStockIn(), getSimStockIn(), getStockOut()])
      .then(([inRes, simRes, outRes]) => {
        setInData(inRes.list)
        setSimData(simRes.list)
        setOutData(outRes.list)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(); getWorkOrders({}).then((r) => setOrders(r.list)) }, [])

  const lowStock = simData.filter((s) => s.stockQty <= 5)

  const filteredInData = useMemo(() => inData.filter((row) => {
    if (!matchDateRange(row.inDate, inQuery.dateRange)) return false
    if (inQuery.supplier && row.supplier !== inQuery.supplier) return false
    if (inQuery.lowStock && row.stockQty > 5) return false
    return fuzzyMatch(row, inQuery.keyword, ['inNo', 'supplier', 'model', 'imei', 'mac', 'receiver', 'remark'])
  }), [inData, inQuery])

  const filteredSimData = useMemo(() => simData.filter((row) => {
    if (!matchDateRange(row.inDate, simQuery.dateRange)) return false
    if (simQuery.operator && row.operator !== simQuery.operator) return false
    if (simQuery.lowStock && row.stockQty > 5) return false
    return fuzzyMatch(row, simQuery.keyword, ['inNo', 'supplier', 'operator', 'iccid', 'receiver', 'remark'])
  }), [simData, simQuery])

  const filteredOutData = useMemo(() => outData.filter((row) => {
    if (!matchDateRange(row.outDate, outQuery.dateRange)) return false
    if (outQuery.operator && row.operator !== outQuery.operator) return false
    return fuzzyMatch(row, outQuery.keyword, ['outNo', 'orderNo', 'storeName', 'customerName', 'model', 'imei', 'mac', 'iccid', 'iccid2', 'receiver', 'remark'])
  }), [outData, outQuery])

  const inSupplierOptions = useMemo(() => uniqueOptions(inData, 'supplier'), [inData])

  const defaultInValues = () => ({
    inDate: dayjs(),
    supplier: '',
    model: '',
    imei: '',
    mac: '',
    qty: 1,
    receiver: user?.name || '',
    remark: '',
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
    outForm.resetFields()
    outForm.setFieldsValue({ outDate: dayjs() })
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
      storeName: order?.storeName || '',
      customerName: order?.customerName || '',
      address: order?.address || '',
      receiver: values.receiver || user.name || '张三',
    })
    message.success('出库成功，库存已扣减')
    closeOutModal()
    load()
  }

  const handleOutImport = async (file) => {
    try {
      const text = await file.text()
      const rows = parseCsvFile(text, OUT_TEMPLATE)
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
    if (record?.id) {
      inForm.setFieldsValue({ ...record, inDate: toStockDayjs(record.inDate) || dayjs() })
    } else {
      inForm.resetFields()
      inForm.setFieldsValue(defaultInValues())
    }
    setInModalOpen(true)
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
      const text = await file.text()
      const rows = parseCsvFile(text, DEVICE_TEMPLATE)
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
    if (record?.id) {
      simForm.setFieldsValue({ ...record, inDate: toStockDayjs(record.inDate) || dayjs() })
    } else {
      simForm.resetFields()
      simForm.setFieldsValue(defaultSimValues())
    }
    setSimModalOpen(true)
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
      const text = await file.text()
      const rows = parseCsvFile(text, SIM_TEMPLATE)
      const res = await importSimStockIn(rows)
      message.success(`成功导入 ${res.count} 条 SIM 卡入库记录`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const actionCol = (onEdit, onDelete) => ({
    title: '操作', width: 130, fixed: 'right',
    render: (_, r) => (
      <Permission code="stock:in">
        <Space size={0}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除该入库记录？" onConfirm={() => onDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      </Permission>
    ),
  })

  const inColumns = [
    { title: '入库单号', dataIndex: 'inNo', width: 150 },
    { title: '入库时间', dataIndex: 'inDate', width: 170 },
    { title: '供应商', dataIndex: 'supplier', width: 80 },
    { title: '设备型号', dataIndex: 'model', width: 100 },
    { title: 'IMEI', dataIndex: 'imei', width: 150 },
    { title: 'MAC', dataIndex: 'mac', width: 150 },
    { title: '数量', dataIndex: 'qty', width: 60 },
    { title: '仓库剩余数量', dataIndex: 'stockQty', width: 110, render: (v) => v <= 5 ? <Tag color="error">{v}</Tag> : v },
    { title: '领用人', dataIndex: 'receiver', width: 80 },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    actionCol(openInEdit, handleInDelete),
  ]

  const simColumns = [
    { title: '入库单号', dataIndex: 'inNo', width: 150 },
    { title: '入库时间', dataIndex: 'inDate', width: 170 },
    { title: '运营商', dataIndex: 'operator', width: 100 },
    { title: 'ICCID', dataIndex: 'iccid', width: 200 },
    { title: '数量', dataIndex: 'qty', width: 60 },
    { title: '库存余量', dataIndex: 'stockQty', width: 90, render: (v) => v <= 5 ? <Tag color="error">{v} ⚠️</Tag> : v },
    { title: '领用人', dataIndex: 'receiver', width: 80 },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    actionCol(openSimEdit, handleSimDelete),
  ]

  const outColumns = [
    { title: '出库单号', dataIndex: 'outNo', width: 150 },
    { title: '出库时间', dataIndex: 'outDate', width: 170 },
    { title: '工单号', dataIndex: 'orderNo', width: 160 },
    { title: '客户门店', dataIndex: 'storeName', width: 120 },
    { title: '设备型号', dataIndex: 'model', width: 100 },
    { title: 'MAC', dataIndex: 'mac', width: 150 },
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
            placeholder="搜索单号/型号/IMEI/MAC/供应商"
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
          permission="stock:in"
          template={DEVICE_TEMPLATE}
          onImport={handleInImport}
          addLabel="新增入库"
          onAdd={() => openInEdit(null)}
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
          permission="stock:in"
          template={SIM_TEMPLATE}
          onImport={handleSimImport}
          addLabel="新增入库"
          onAdd={() => openSimEdit(null)}
        />
      )}
    />
  )

  const outToolbar = (
    <ListToolbar
      filters={(
        <>
          <FilterInput
            placeholder="搜索单号/工单/门店/客户/MAC/ICCID"
            value={outFilters.keyword}
            onChange={(e) => setOutFilters((f) => ({ ...f, keyword: e.target.value }))}
            onPressEnter={() => setOutQuery({ ...outFilters })}
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
          permission="stock:out"
          template={OUT_TEMPLATE}
          onImport={handleOutImport}
          addLabel="新增出库"
          onAdd={openOut}
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
          <Table columns={inColumns} dataSource={filteredInData} rowKey="id" loading={loading} scroll={{ x: 1300 }} pagination={TABLE_PAGE} />
        </>
      ),
    },
    {
      key: 'sim',
      label: <span>SIM 卡入库 {lowStock.length > 0 && <Tag color="error">{lowStock.length} 项预警</Tag>}</span>,
      children: (
        <>
          {lowStock.length > 0 && <Alert type="warning" message={`${lowStock.length} 项 SIM 卡库存低于阈值（≤5）`} style={{ marginBottom: 16 }} showIcon />}
          {simToolbar}
          <Table columns={simColumns} dataSource={filteredSimData} rowKey="id" loading={loading} scroll={{ x: 1100 }} pagination={TABLE_PAGE} />
        </>
      ),
    },
    { key: 'out', label: '设备出库', children: (
      <>
        {outToolbar}
        <Table columns={outColumns} dataSource={filteredOutData} rowKey="id" loading={loading} scroll={{ x: 1380 }} pagination={TABLE_PAGE} />
      </>
    ) },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>设备出入库</h2>
        <p>入库、出库关联工单，库存自动扣减</p>
      </div>
      <Tabs items={items} />

      <Modal title="新增出库单" open={outModalOpen} onOk={handleOut} onCancel={closeOutModal} width={560} destroyOnClose>
        <Form form={outForm} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
          <Form.Item name="outDate" label="出库时间" rules={[{ required: true }]}>
            <DatePicker {...stockDateTimePickerProps} placeholder="选择出库时间" />
          </Form.Item>
          <Form.Item name="orderNo" label="关联工单" rules={[{ required: true }]}>
            <Select placeholder="选择工单" showSearch options={orders.map((o) => ({ value: o.orderNo, label: `${o.orderNo} - ${o.customerName}` }))} />
          </Form.Item>
          <Form.Item name="model" label="设备型号" rules={[{ required: true }]}><Input placeholder="鲲鹏618" /></Form.Item>
          <Form.Item name="mac" label="MAC" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="iccid" label="ICCID"><Input /></Form.Item>
          <Form.Item name="iccid2" label="ICCID2"><Input /></Form.Item>
          <Form.Item name="operator" label="运营商">
            <Select options={OPERATORS.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={currentIn?.id ? '编辑设备入库' : '新增设备入库'}
        open={inModalOpen}
        onOk={handleInSave}
        onCancel={closeInModal}
        width={560}
        destroyOnClose
      >
        <Form form={inForm} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
          {currentIn?.inNo && <Form.Item label="入库单号"><Input value={currentIn.inNo} disabled /></Form.Item>}
          <Form.Item name="inDate" label="入库时间" rules={[{ required: true }]}>
            <DatePicker {...stockDateTimePickerProps} placeholder="选择入库时间" />
          </Form.Item>
          <Form.Item name="supplier" label="供应商" rules={[{ required: true }]}><Input placeholder="鲲鹏、云软" /></Form.Item>
          <Form.Item name="model" label="设备型号" rules={[{ required: true }]}><Input placeholder="鲲鹏618" /></Form.Item>
          <Form.Item name="imei" label="IMEI" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="mac" label="MAC" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="qty" label="数量" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="receiver" label="领用人"><Input /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={currentSim?.id ? '编辑 SIM 卡入库' : '新增 SIM 卡入库'}
        open={simModalOpen}
        onOk={handleSimSave}
        onCancel={closeSimModal}
        width={560}
        destroyOnClose
      >
        <Form form={simForm} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
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
        </Form>
      </Modal>
    </div>
  )
}
