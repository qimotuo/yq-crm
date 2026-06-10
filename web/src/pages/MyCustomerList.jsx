import { useEffect, useState } from 'react'
import { Table, Input, Button, Space, Tag, Modal, Form, Select, Timeline, message, Popconfirm } from 'antd'
import { SearchOutlined, PhoneOutlined, PlusOutlined, RollbackOutlined } from '@ant-design/icons'
import { getCustomers, getFollowUps, createFollowUp, returnCustomer } from '../api'
import { callPhone } from '../components/PhoneBar'
import { useAuth } from '../hooks/useAuth'

export default function MyCustomerList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')
  const [followModal, setFollowModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const [followUps, setFollowUps] = useState([])
  const [form] = Form.useForm()
  const { user } = useAuth()

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (user.role === 'sales') params.salesName = user.name
      if (keyword) params.keyword = keyword
      const res = await getCustomers(params)
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openFollow = async (record) => {
    setCurrent(record)
    const res = await getFollowUps({ customerId: record.id })
    setFollowUps(res.list)
    setFollowModal(true)
  }

  const handleAddFollow = async () => {
    const values = await form.validateFields()
    await createFollowUp({ ...values, customerId: current.id, customerName: current.customerName, salesName: user.name })
    message.success('跟进记录已添加')
    form.resetFields()
    const res = await getFollowUps({ customerId: current.id })
    setFollowUps(res.list)
  }

  const handleReturn = async (record) => {
    await returnCustomer(record)
    message.success('已退回公海池')
    load()
  }

  const columns = [
    { title: '店名', dataIndex: 'storeName', width: 120 },
    { title: '客户名称', dataIndex: 'customerName', width: 160 },
    { title: '联系人', dataIndex: 'contact', width: 80 },
    {
      title: '手机号', dataIndex: 'phone', width: 130,
      render: (v) => <a onClick={() => callPhone(v)}><PhoneOutlined /> {v}</a>,
    },
    { title: '工单号', dataIndex: 'orderNo', width: 160, render: (v) => v || '-' },
    {
      title: '联系状态', dataIndex: 'contactStatus', width: 90,
      render: (s) => <Tag color={s === '正常' ? 'success' : 'error'}>{s}</Tag>,
    },
    {
      title: '操作', width: 200,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openFollow(r)}>跟进</Button>
          <Popconfirm title="确认退回公海？" onConfirm={() => handleReturn(r)}>
            <Button type="link" size="small" danger icon={<RollbackOutlined />}>退回</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>我的客户</h2>
        <p>销售私海客户，支持外呼、跟进、退回公海</p>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索客户" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
        <Button type="primary" onClick={load}>查询</Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title={`跟进记录 — ${current?.customerName}`} open={followModal} onCancel={() => setFollowModal(false)} footer={null} width={640}>
        <Timeline style={{ marginTop: 16, marginBottom: 24, maxHeight: 240, overflow: 'auto' }}
          items={followUps.map((f) => ({
            children: <div><Tag>{f.type}</Tag> {f.content}<div style={{ color: '#999', fontSize: 12 }}>{f.createTime} · 下次: {f.nextPlan || '-'}</div></div>,
          }))}
        />
        <Form form={form} layout="inline">
          <Form.Item name="type" rules={[{ required: true }]} initialValue="电话">
            <Select style={{ width: 90 }} options={['电话', '微信', '上门'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="content" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="跟进内容" style={{ width: 280 }} />
          </Form.Item>
          <Form.Item name="nextPlan"><Input placeholder="下次计划" style={{ width: 120 }} /></Form.Item>
          <Form.Item><Button type="primary" icon={<PlusOutlined />} onClick={handleAddFollow}>添加</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
