import { useEffect, useState } from 'react'
import { Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, message, Alert } from 'antd'
import { PlusOutlined, BellOutlined } from '@ant-design/icons'
import { getSchedules, createSchedule } from '../api'
import dayjs from 'dayjs'

const typeColors = { 上门: 'blue', 电话: 'green', 安装: 'orange' }

export default function ScheduleList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const today = dayjs().format('YYYY-MM-DD')

  const load = async () => {
    setLoading(true)
    try {
      const res = await getSchedules({})
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const todayList = data.filter((s) => s.date === today && s.status === '待执行')

  const handleCreate = async () => {
    const values = await form.validateFields()
    values.date = values.date.format('YYYY-MM-DD')
    await createSchedule(values)
    message.success('日程已添加')
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const columns = [
    { title: '日期', dataIndex: 'date', width: 110 },
    { title: '时间', dataIndex: 'time', width: 80 },
    { title: '标题', dataIndex: 'title', width: 180 },
    { title: '客户', dataIndex: 'customerName', width: 160 },
    { title: '类型', dataIndex: 'type', width: 80, render: (t) => <Tag color={typeColors[t]}>{t}</Tag> },
    { title: '销售', dataIndex: 'salesName', width: 80 },
    { title: '状态', dataIndex: 'status', width: 90, render: (s) => <Tag color={s === '已完成' ? 'success' : 'processing'}>{s}</Tag> },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>日程管理</h2>
        <p>销售拜访、回访、安装预约日程</p>
      </div>

      {todayList.length > 0 && (
        <Alert type="info" showIcon icon={<BellOutlined />} style={{ marginBottom: 16 }}
          message={`今日待办 ${todayList.length} 项`}
          description={todayList.map((s) => `${s.time} ${s.title}`).join(' · ')} />
      )}

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加日程</Button>
      </Space>

      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="添加日程" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="customerName" label="客户" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true }]} initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="time" label="时间" rules={[{ required: true }]} initialValue="14:00"><Input placeholder="如 14:00" /></Form.Item>
          <Form.Item name="type" label="类型" initialValue="上门">
            <Select options={['上门', '电话', '安装'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
