import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Select, Modal, Form, Input, message, Timeline } from 'antd'
import { PlusOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { getFollowUps, createFollowUp, getCustomers } from '../api'
import { useAuth } from '../hooks/useAuth'
import { openCreateForm, closeFormModal } from '../utils/formModal'
import { ListToolbar, FilterInput, FilterField, FilterSelect, QueryButton, ResetButton, applyFilterPatch } from '../components/ListToolbar'

const EMPTY_FILTERS = { customer: '', type: '', sales: '', content: '', status: '' }

const typeColor = { 电话: 'blue', 微信: 'green', 上门: 'orange' }
const statusColor = { 已完成: 'success', 待完成: 'warning' }

export default function FollowUpList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const [customers, setCustomers] = useState([])
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [query, setQuery] = useState({ ...EMPTY_FILTERS })
  const [modalOpen, setModalOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [timelineData, setTimelineData] = useState([])
  const [timelineTitle, setTimelineTitle] = useState('')
  const [form] = Form.useForm()
  const { user } = useAuth()
  const isSales = user.role === 'sales'

  const load = async (q = query) => {
    setLoading(true)
    try {
      const params = {}
      if (q.customer) params.customerId = q.customer
      if (q.type) params.type = q.type
      if (q.sales) params.salesName = q.sales
      if (q.content) params.keyword = q.content
      if (q.status) params.status = q.status
      const res = await getFollowUps(params)
      let list = res.list
      if (isSales) list = list.filter((f) => f.salesName === user.name)
      setData(list)
    } finally {
      setLoading(false)
    }
  }

  const onSelectFilter = (key) => (v) => applyFilterPatch({ [key]: v || '' }, setFilters, (next) => {
    setQuery(next)
    load(next)
  })

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))

  const handleSearch = () => {
    setQuery({ ...filters })
    load({ ...filters })
  }

  const handleReset = () => {
    setFilters({ ...EMPTY_FILTERS })
    setQuery({ ...EMPTY_FILTERS })
    load({ ...EMPTY_FILTERS })
  }

  useEffect(() => {
    const params = isSales ? { salesName: user.name } : {}
    getCustomers(params).then((res) => setCustomers(res.list))
    load()
  }, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    const customer = customers.find((c) => c.id === values.customerId)
    await createFollowUp({
      ...values,
      customerId: values.customerId,
      customerName: customer?.customerName || values.customerName,
      salesName: user.name,
      status: values.status || (values.nextPlan ? '待完成' : '已完成'),
    })
    message.success('跟进记录已添加')
    closeFormModal(form, setModalOpen)
    load()
  }

  const openCreate = () => {
    openCreateForm(form, { type: '电话', status: '待完成' })
    setModalOpen(true)
  }

  const showTimeline = async (customerName) => {
    const customer = customers.find((c) => c.customerName === customerName)
    const params = customer ? { customerId: customer.id } : {}
    const res = await getFollowUps(params)
    const list = res.list.filter((f) => f.customerName === customerName)
    setTimelineData(list)
    setTimelineTitle(customerName)
    setTimelineOpen(true)
  }

  const columns = [
    { title: '时间', dataIndex: 'createTime', width: 140 },
    {
      title: '客户', dataIndex: 'customerName', width: 140, ellipsis: true,
      render: (v) => <a onClick={() => showTimeline(v)}>{v}</a>,
    },
    { title: '销售', dataIndex: 'salesName', width: 72 },
    { title: '方式', dataIndex: 'type', width: 72, render: (t) => <Tag color={typeColor[t]}>{t}</Tag> },
    { title: '跟进内容', dataIndex: 'content', width: 200, ellipsis: true },
    { title: '下次计划', dataIndex: 'nextPlan', width: 130, ellipsis: true },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s) => <Tag color={statusColor[s] || 'default'}>{s || '已完成'}</Tag>,
    },
    {
      title: '操作', width: 88, fixed: 'right',
      render: (_, r) => (
        <Button type="link" size="small" style={{ padding: 0 }} icon={<UnorderedListOutlined />} onClick={() => showTimeline(r.customerName)}>时间线</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>跟进记录</h2>
        <p>查看销售对客户的跟进历史，支持按客户筛选与时间线展示</p>
      </div>
      <ListToolbar
        filters={(
          <>
            <FilterSelect wide placeholder="筛选客户" value={filters.customer || undefined} onChange={onSelectFilter('customer')}
              options={customers.map((c) => ({ value: c.id, label: c.customerName }))} />
            <FilterSelect placeholder="跟进方式" value={filters.type || undefined} onChange={onSelectFilter('type')}
              options={['电话', '微信', '上门'].map((v) => ({ value: v, label: v }))} />
            {!isSales && (
              <FilterField placeholder="销售名称" value={filters.sales} onChange={(e) => setFilter('sales', e.target.value)} onPressEnter={handleSearch} />
            )}
            <FilterField placeholder="跟进内容" value={filters.content} onChange={(e) => setFilter('content', e.target.value)} onPressEnter={handleSearch} />
            <FilterSelect placeholder="状态" value={filters.status || undefined} onChange={onSelectFilter('status')}
              options={['已完成', '待完成'].map((v) => ({ value: v, label: v }))} />
            <QueryButton loading={loading} onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增跟进</Button>
        )}
      />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 940 }} pagination={{ pageSize: 10 }} />

      <Modal title="新增跟进记录" open={modalOpen} onOk={handleCreate} onCancel={() => closeFormModal(form, setModalOpen)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
          <Form.Item name="customerId" label="客户" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={customers.map((c) => ({ value: c.id, label: `${c.customerName}（${c.storeName}）` }))} />
          </Form.Item>
          <Form.Item name="type" label="跟进方式">
            <Select options={['电话', '微信', '上门'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="content" label="跟进内容" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="nextPlan" label="下次计划"><Input placeholder="如 2026-06-12 回访" /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={['已完成', '待完成'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`跟进时间线 — ${timelineTitle}`} open={timelineOpen} onCancel={() => setTimelineOpen(false)} footer={null} width={560}>
        <Timeline style={{ marginTop: 16, maxHeight: 400, overflow: 'auto' }}
          items={timelineData.map((f) => ({
            children: <div><Tag color={typeColor[f.type]}>{f.type}</Tag> <Tag color={statusColor[f.status]}>{f.status || '已完成'}</Tag> {f.content}<div style={{ color: '#999', fontSize: 12 }}>{f.createTime} · {f.salesName} · 下次: {f.nextPlan || '-'}</div></div>,
          }))}
        />
      </Modal>
    </div>
  )
}
