import { useEffect, useState } from 'react'
import { Table, Button, Tag, Modal, Form, Input, Select, DatePicker, message, Alert } from 'antd'
import { PlusOutlined, BellOutlined, CheckOutlined } from '@ant-design/icons'
import { getSchedules, createSchedule, completeSchedule } from '../api/notify'
import { useAuth } from '../hooks/useAuth'
import { ListToolbar, QueryButton, ResetButton, FilterSelect } from '../components/ListToolbar'
import dayjs from 'dayjs'

const typeColors = { 上门: 'blue', 电话: 'green', 安装: 'orange' }

export default function ScheduleList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const { user } = useAuth()
  const today = dayjs().format('YYYY-MM-DD')

  const load = async (status = statusFilter) => {
    setLoading(true)
    try {
      const res = await getSchedules({})
      let list = res.list
      if (user.role === 'sales') list = list.filter((s) => s.salesName === user.name)
      if (status) list = list.filter((s) => s.status === status)
      setData(list)
    } finally {
      setLoading(false)
    }
  }

  const onStatusChange = (v) => {
    const status = v || ''
    setStatusFilter(status)
    load(status)
  }

  const handleReset = () => {
    setStatusFilter('')
    load('')
  }

  useEffect(() => { load() }, [])

  const todayList = data.filter((s) => s.date === today && s.status === '待执行')

  const handleCreate = async () => {
    const values = await form.validateFields()
    values.date = values.date.format('YYYY-MM-DD')
    await createSchedule({ ...values, salesName: user.name })
    message.success('日程已添加')
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const handleComplete = async (id) => {
    await completeSchedule(id)
    message.success('日程已完成')
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
    {
      title: '操作', width: 90,
      render: (_, r) => r.status === '待执行' ? (
        <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleComplete(r.id)}>完成</Button>
      ) : null,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>日程管理</h2>
        <p>销售拜访、回访、安装预约日程，支持今日提醒与完成标记</p>
      </div>

      {todayList.length > 0 && (
        <Alert type="info" showIcon icon={<BellOutlined />} style={{ marginBottom: 16 }}
          message={`今日待办 ${todayList.length} 项`}
          description={todayList.map((s) => `${s.time} ${s.title}（${s.customerName}）`).join(' · ')} />
      )}

      <ListToolbar
        filters={(
          <>
            <FilterSelect placeholder="状态筛选" value={statusFilter || undefined} onChange={onStatusChange}
              options={['待执行', '已完成'].map((v) => ({ value: v, label: v }))} />
            <QueryButton loading={loading} onClick={() => load()} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加日程</Button>
        )}
      />

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
