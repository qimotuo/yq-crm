import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Select, Modal, Form, Input, message, Timeline } from 'antd'
import { PlusOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { getFollowUps, createFollowUp, getCustomers } from '../api'
import { useAuth } from '../hooks/useAuth'

const typeColor = { 电话: 'blue', 微信: 'green', 上门: 'orange' }

export default function FollowUpList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [customers, setCustomers] = useState([])
  const [filterCustomer, setFilterCustomer] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [timelineData, setTimelineData] = useState([])
  const [timelineTitle, setTimelineTitle] = useState('')
  const [form] = Form.useForm()
  const { user } = useAuth()

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterCustomer) params.customerId = filterCustomer
      const res = await getFollowUps(params)
      let list = res.list
      if (user.role === 'sales') list = list.filter((f) => f.salesName === user.name)
      setData(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = user.role === 'sales' ? { salesName: user.name } : {}
    getCustomers(params).then((res) => setCustomers(res.list))
    load()
  }, [filterCustomer])

  const handleCreate = async () => {
    const values = await form.validateFields()
    const customer = customers.find((c) => c.id === values.customerId)
    await createFollowUp({
      ...values,
      customerId: values.customerId,
      customerName: customer?.customerName || values.customerName,
      salesName: user.name,
    })
    message.success('跟进记录已添加')
    setModalOpen(false)
    form.resetFields()
    load()
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
    { title: '时间', dataIndex: 'createTime', width: 150 },
    {
      title: '客户', dataIndex: 'customerName', width: 180,
      render: (v) => <a onClick={() => showTimeline(v)}>{v}</a>,
    },
    { title: '销售', dataIndex: 'salesName', width: 80 },
    { title: '方式', dataIndex: 'type', width: 80, render: (t) => <Tag color={typeColor[t]}>{t}</Tag> },
    { title: '跟进内容', dataIndex: 'content', ellipsis: true },
    { title: '下次计划', dataIndex: 'nextPlan', width: 150 },
    {
      title: '操作', width: 80,
      render: (_, r) => <Button type="link" size="small" icon={<UnorderedListOutlined />} onClick={() => showTimeline(r.customerName)}>时间线</Button>,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>跟进记录</h2>
        <p>查看销售对客户的跟进历史，支持按客户筛选与时间线展示</p>
      </div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select placeholder="筛选客户" value={filterCustomer || undefined} onChange={setFilterCustomer} allowClear style={{ width: 220 }}
          options={customers.map((c) => ({ value: c.id, label: c.customerName }))} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增跟进</Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="新增跟进记录" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="customerId" label="客户" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={customers.map((c) => ({ value: c.id, label: `${c.customerName}（${c.storeName}）` }))} />
          </Form.Item>
          <Form.Item name="type" label="跟进方式" initialValue="电话">
            <Select options={['电话', '微信', '上门'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="content" label="跟进内容" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="nextPlan" label="下次计划"><Input placeholder="如 2026-06-12 回访" /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`跟进时间线 — ${timelineTitle}`} open={timelineOpen} onCancel={() => setTimelineOpen(false)} footer={null} width={560}>
        <Timeline style={{ marginTop: 16, maxHeight: 400, overflow: 'auto' }}
          items={timelineData.map((f) => ({
            children: <div><Tag color={typeColor[f.type]}>{f.type}</Tag> {f.content}<div style={{ color: '#999', fontSize: 12 }}>{f.createTime} · {f.salesName} · 下次: {f.nextPlan || '-'}</div></div>,
          }))}
        />
      </Modal>
    </div>
  )
}
