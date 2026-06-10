import { useEffect, useState } from 'react'
import { Table, Input, Button, Space, Tag, Modal, Form, Select, Timeline, message, Popconfirm, Dropdown } from 'antd'
import { SearchOutlined, PhoneOutlined, PlusOutlined, RollbackOutlined, WechatOutlined, FileAddOutlined, DownOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getCustomers, getFollowUps, createFollowUp, returnCustomer, updateCustomer } from '../api'
import { callPhone } from '../components/PhoneBar'
import { Permission } from '../components/RequireAuth'
import { useAuth } from '../hooks/useAuth'

const STATUS_COLOR = { 正常: 'success', 中断合作: 'error', 待跟进: 'warning' }
const CONTACT_STATUSES = ['正常', '中断合作', '待跟进']

export default function MyCustomerList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')
  const [followModal, setFollowModal] = useState(false)
  const [wechatModal, setWechatModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const [followUps, setFollowUps] = useState([])
  const [form] = Form.useForm()
  const [wechatForm] = Form.useForm()
  const { user } = useAuth()
  const navigate = useNavigate()

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
    load()
  }

  const handleReturn = async (record) => {
    await returnCustomer({ id: record.id, customerName: record.customerName, storeName: record.storeName, reason: '手动退回' })
    message.success('已退回公海池')
    load()
  }

  const handleStatusChange = async (record, contactStatus) => {
    await updateCustomer(record.id, { contactStatus })
    message.success('联系状态已更新')
    load()
  }

  const openWechat = (record) => {
    setCurrent(record)
    wechatForm.setFieldsValue({ wechatId: record.wechatId || '' })
    setWechatModal(true)
  }

  const saveWechat = async () => {
    const values = await wechatForm.validateFields()
    await updateCustomer(current.id, values)
    message.success('微信号已记录')
    setWechatModal(false)
    load()
  }

  const createWorkOrder = (record) => {
    navigate('/work-orders', { state: { prefill: {
      storeName: record.storeName, customerName: record.customerName,
      contact: record.contact, contactPhone: record.phone, address: record.address || '',
    } } })
  }

  const columns = [
    { title: '店名', dataIndex: 'storeName', width: 120 },
    { title: '客户名称', dataIndex: 'customerName', width: 160 },
    { title: '联系人', dataIndex: 'contact', width: 80 },
    {
      title: '手机号', dataIndex: 'phone', width: 130,
      render: (v) => (
        <Permission code="customer:call" fallback={v}>
          <a onClick={() => callPhone(v)}><PhoneOutlined /> {v}</a>
        </Permission>
      ),
    },
    { title: '领取时间', dataIndex: 'claimTime', width: 140, render: (v) => v || '-' },
    { title: '最近跟进', dataIndex: 'lastFollowTime', width: 140, render: (v) => v || '-' },
    { title: '工单号', dataIndex: 'orderNo', width: 160, render: (v) => v || '-' },
    {
      title: '联系状态', dataIndex: 'contactStatus', width: 100,
      render: (s, r) => (
        <Dropdown menu={{
          items: CONTACT_STATUSES.map((v) => ({ key: v, label: v, onClick: () => handleStatusChange(r, v) })),
        }}>
          <Tag color={STATUS_COLOR[s] || 'default'} style={{ cursor: 'pointer' }}>{s} <DownOutlined /></Tag>
        </Dropdown>
      ),
    },
    {
      title: '操作', width: 260,
      render: (_, r) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => openFollow(r)}>跟进</Button>
          <Button type="link" size="small" icon={<WechatOutlined />} onClick={() => openWechat(r)}>微信</Button>
          <Button type="link" size="small" icon={<FileAddOutlined />} onClick={() => createWorkOrder(r)}>建工单</Button>
          <Permission code="customer:return">
            <Popconfirm title="确认退回公海？" onConfirm={() => handleReturn(r)}>
              <Button type="link" size="small" danger icon={<RollbackOutlined />}>退回</Button>
            </Popconfirm>
          </Permission>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>我的客户</h2>
        <p>销售私海客户，支持外呼、跟进、微信、建工单、退回公海</p>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索客户" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
        <Button type="primary" onClick={load}>查询</Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 1200 }} />

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

      <Modal title={`添加微信 — ${current?.customerName}`} open={wechatModal} onOk={saveWechat} onCancel={() => setWechatModal(false)}>
        <Form form={wechatForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="wechatId" label="微信号" rules={[{ required: true }]}>
            <Input placeholder="记录客户微信号" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
