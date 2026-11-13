import { useEffect, useMemo, useState } from 'react'
import { Table, Tabs, Button, Modal, Form, Input, Select, DatePicker, Card, Statistic, Row, Col, Tag, Popconfirm, message } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getAccountLedger, createAccountLedger, deleteAccountLedger } from '../api'
import { Permission } from '../components/RequireAuth'
import ExportButton from '../components/ExportButton'
import { ListToolbar, FilterInput, FilterField, FilterSelect, QueryButton, ResetButton } from '../components/ListToolbar'
import { formatMoney } from '../utils/helpers'
import { useAuth } from '../hooks/useAuth'
import {
  ACCOUNT_SECTIONS, ACCOUNT_IN_CATEGORIES, ACCOUNT_OUT_CATEGORIES, getAccountRemarkRule,
} from '../constants/ledger'
import { useTablePagination } from '../hooks/useTablePagination'

const dirLabel = { in: '入账', out: '出账' }
const dirColor = { in: 'green', out: 'red' }
const EMPTY_FILTERS = { keyword: '', category: '', createdBy: '', amountMin: '', amountMax: '' }

function matchAmountRange(amount, min, max) {
  if (min !== '' && min != null) {
    const n = Number(min)
    if (!Number.isNaN(n) && amount < n) return false
  }
  if (max !== '' && max != null) {
    const n = Number(max)
    if (!Number.isNaN(n) && amount > n) return false
  }
  return true
}

export default function AccountLedger() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const [section, setSection] = useState('基米网')
  const [direction, setDirection] = useState('in')
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [query, setQuery] = useState({ ...EMPTY_FILTERS })
  const [month, setMonth] = useState(dayjs())
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const { user } = useAuth()
  const monthStr = month.format('YYYY-MM')

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAccountLedger({ month: monthStr, section })
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [monthStr, section])

  useEffect(() => {
    setFilters({ ...EMPTY_FILTERS })
    setQuery({ ...EMPTY_FILTERS })
  }, [section, direction])

  const directionData = useMemo(() => data.filter((r) => r.direction === direction), [data, direction])

  const categoryOptions = useMemo(
    () => (direction === 'in' ? ACCOUNT_IN_CATEGORIES : ACCOUNT_OUT_CATEGORIES).map((c) => ({ value: c, label: c })),
    [direction],
  )

  const createdByOptions = useMemo(
    () => [...new Set(directionData.map((r) => r.createdBy).filter(Boolean))].map((v) => ({ value: v, label: v })),
    [directionData],
  )

  const filtered = useMemo(() => directionData.filter((r) => {
    if (query.category && r.category !== query.category) return false
    if (query.createdBy && r.createdBy !== query.createdBy) return false
    if (!matchAmountRange(r.amount, query.amountMin, query.amountMax)) return false
    if (query.keyword) {
      const kw = query.keyword.trim().toLowerCase()
      const text = `${r.remark || ''} ${r.remarkOption || ''}`.toLowerCase()
      if (!text.includes(kw)) return false
    }
    return true
  }), [directionData, query])
  const { pagination } = useTablePagination(20, filtered.length)

  const handleSearch = () => setQuery({ ...filters })
  const handleReset = () => {
    setFilters({ ...EMPTY_FILTERS })
    setQuery({ ...EMPTY_FILTERS })
  }

  const summary = useMemo(() => {
    const inSum = data.filter((r) => r.direction === 'in').reduce((s, r) => s + r.amount, 0)
    const outSum = data.filter((r) => r.direction === 'out').reduce((s, r) => s + r.amount, 0)
    return { inSum, outSum, balance: inSum - outSum }
  }, [data])

  const categories = direction === 'in' ? ACCOUNT_IN_CATEGORIES : ACCOUNT_OUT_CATEGORIES
  const formCategory = Form.useWatch('category', form)
  const remarkRule = getAccountRemarkRule(formCategory || categories[0], direction)

  const openCreate = () => {
    form.setFieldsValue({
      entryDate: dayjs(),
      category: categories[0],
      amount: undefined,
      remark: undefined,
      remarkOption: undefined,
    })
    setModalOpen(true)
  }

  const handleCreate = async () => {
    const values = await form.validateFields()
    await createAccountLedger({
      section,
      direction,
      category: values.category,
      amount: Number(values.amount),
      entryDate: values.entryDate.format('YYYY-MM-DD'),
      remark: values.remark || '',
      remarkOption: values.remarkOption || '',
      createdBy: user.name,
    })
    message.success('已记账')
    setModalOpen(false)
    load()
  }

  const handleDelete = async (id) => {
    await deleteAccountLedger(id)
    message.success('已删除')
    load()
  }

  const renderRemark = (_, r) => {
    if (r.category === '流量账单' && r.remarkOption) return r.remarkOption
    return r.remark || '-'
  }

  const columns = [
    { title: '日期', dataIndex: 'entryDate', width: 110 },
    { title: '方向', dataIndex: 'direction', width: 72, render: (d) => <Tag color={dirColor[d]}>{dirLabel[d]}</Tag> },
    { title: '分类', dataIndex: 'category', width: 120 },
    { title: '金额', dataIndex: 'amount', width: 100, render: (v, r) => <span style={{ color: r.direction === 'in' ? '#3f8600' : '#cf1322' }}>{formatMoney(v)}</span> },
    { title: '备注', width: 160, ellipsis: true, render: renderRemark },
    { title: '录入人', dataIndex: 'createdBy', width: 88 },
    {
      title: '操作', width: 72, fixed: 'right',
      render: (_, r) => (
        <Permission code="account-ledger:delete">
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Permission>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>账户账本</h2>
        <DatePicker picker="month" value={month} onChange={(v) => v && setMonth(v)} allowClear={false} />
      </div>

      <Tabs activeKey={section} onChange={setSection} items={ACCOUNT_SECTIONS.map((s) => ({ key: s, label: s }))} />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card size="small"><Statistic title={`${monthStr} 入账`} value={summary.inSum} precision={2} prefix="¥" valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title={`${monthStr} 出账`} value={summary.outSum} precision={2} prefix="¥" valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="结余" value={summary.balance} precision={2} prefix="¥" /></Card></Col>
      </Row>

      <ListToolbar
        filters={(
          <Tabs
            activeKey={direction}
            onChange={setDirection}
            size="small"
            className="toolbar-tabs"
            items={[
              { key: 'in', label: '入账' },
              { key: 'out', label: '出账' },
            ]}
          />
        )}
        actions={(
          <>
            <Permission code="account-ledger:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>记一笔</Button>
            </Permission>
            <Permission code="account-ledger:export">
              <ExportButton filename="account-ledger.csv" label="导出" data={filtered} columns={columns} />
            </Permission>
          </>
        )}
      />
      <ListToolbar
        nested
        filters={(
          <>
            <FilterInput
              placeholder="搜索备注"
              value={filters.keyword}
              onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
              onPressEnter={handleSearch}
            />
            <FilterSelect
              placeholder="分类"
              value={filters.category || undefined}
              onChange={(v) => setFilters((f) => ({ ...f, category: v || '' }))}
              options={categoryOptions}
            />
            <FilterSelect
              placeholder="录入人"
              value={filters.createdBy || undefined}
              onChange={(v) => setFilters((f) => ({ ...f, createdBy: v || '' }))}
              options={createdByOptions}
            />
            <FilterField
              type="number"
              min={0}
              step={0.01}
              placeholder="最低金额"
              value={filters.amountMin}
              onChange={(e) => setFilters((f) => ({ ...f, amountMin: e.target.value }))}
              onPressEnter={handleSearch}
            />
            <FilterField
              type="number"
              min={0}
              step={0.01}
              placeholder="最高金额"
              value={filters.amountMax}
              onChange={(e) => setFilters((f) => ({ ...f, amountMax: e.target.value }))}
              onPressEnter={handleSearch}
            />
            <QueryButton loading={loading} onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
          </>
        )}
      />

      <Table rowKey="id" loading={loading} dataSource={filtered} columns={columns} scroll={{ x: 720 }} pagination={{ ...pagination, showTotal: (t) => `共 ${t} 条` }} />

      <Modal title={`记一笔 · ${section} · ${dirLabel[direction]}`} open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="entryDate" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select options={categories.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
            <Input type="number" min={0.01} step={0.01} prefix="¥" />
          </Form.Item>
          {remarkRule.type === 'select' && (
            <Form.Item name="remarkOption" label="流量类型" rules={[{ required: true, message: '请选择' }]}>
              <Select options={remarkRule.options.map((o) => ({ value: o, label: o }))} />
            </Form.Item>
          )}
          {remarkRule.type === 'text' && (
            <Form.Item name="remark" label="备注" rules={remarkRule.required ? [{ required: true, message: '请填写备注' }] : []}>
              <Input placeholder={remarkRule.placeholder} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
