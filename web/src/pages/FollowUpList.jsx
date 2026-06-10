import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, Select, Modal, Form, Input, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getFollowUps, createFollowUp } from '../api'
import { useAuth } from '../hooks/useAuth'

const typeColor = { 电话: 'blue', 微信: 'green', 上门: 'orange' }

export default function FollowUpList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const { user } = useAuth()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getFollowUps({})
      let list = res.list
      if (user.role === 'sales') list = list.filter((f) => f.salesName === user.name)
      setData(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    await createFollowUp({ ...values, salesName: user.name })
    message.success('跟进记录已添加')
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const columns = [
    { title: '时间', dataIndex: 'createTime', width: 150 },
    { title: '客户', dataIndex: 'customerName', width: 180 },
    { title: '销售', dataIndex: 'salesName', width: 80 },
    { title: '方式', dataIndex: 'type', width: 80, render: (t) => <Tag color={typeColor[t]}>{t}</Tag> },
    { title: '跟进内容', dataIndex: 'content', ellipsis: true },
    { title: '下次计划', dataIndex: 'nextPlan', width: 150 },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>跟进记录</h2>
        <p>查看销售对客户的跟进历史</p>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增跟进</Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="新增跟进记录" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="跟进方式" initialValue="电话">
            <Select options={['电话', '微信', '上门'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="content" label="跟进内容" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="nextPlan" label="下次计划"><Input placeholder="如 2026-06-12 回访" /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
