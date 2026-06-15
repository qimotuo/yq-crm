import { useEffect, useMemo, useState } from 'react'
import { Table, Tabs, Button, Modal, Form, Input, Select, DatePicker, Card, Statistic, Row, Col, Popconfirm, message } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getAdminLedger, createAdminLedger, deleteAdminLedger } from '../api'
import { Permission } from '../components/RequireAuth'
import { formatMoney } from '../utils/helpers'
import { useAuth } from '../hooks/useAuth'
import { ADMIN_CATEGORIES } from '../constants/ledger'

export default function AdminLedger() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const [category, setCategory] = useState('日常账单')
  const [month, setMonth] = useState(dayjs())
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const { user } = useAuth()
  const monthStr = month.format('YYYY-MM')

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAdminLedger({ month: monthStr })
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [monthStr])

  const filtered = useMemo(() => data.filter((r) => r.category === category), [data, category])

  const summary = useMemo(() => {
    const daily = data.filter((r) => r.category === '日常账单').reduce((s, r) => s + r.amount, 0)
    const ops = data.filter((r) => r.category === '公司运营账单').reduce((s, r) => s + r.amount, 0)
    return { daily, ops, total: daily + ops }
  }, [data])

  const openCreate = () => {
    form.setFieldsValue({ entryDate: dayjs(), category, amount: undefined, remark: undefined })
    setModalOpen(true)
  }

  const handleCreate = async () => {
    const values = await form.validateFields()
    await createAdminLedger({
      category: values.category,
      amount: Number(values.amount),
      entryDate: values.entryDate.format('YYYY-MM-DD'),
      remark: values.remark,
      createdBy: user.name,
    })
    message.success('已记账')
    setModalOpen(false)
    load()
  }

  const handleDelete = async (id) => {
    await deleteAdminLedger(id)
    message.success('已删除')
    load()
  }

  const columns = [
    { title: '日期', dataIndex: 'entryDate', width: 110 },
    { title: '类型', dataIndex: 'category', width: 120 },
    { title: '金额', dataIndex: 'amount', width: 100, render: (v) => <span style={{ color: '#cf1322' }}>{formatMoney(v)}</span> },
    { title: '用途备注', dataIndex: 'remark', width: 200, ellipsis: true },
    { title: '录入人', dataIndex: 'createdBy', width: 88 },
    {
      title: '操作', width: 72, fixed: 'right',
      render: (_, r) => (
        <Permission code="admin-ledger:delete">
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
        <h2 style={{ margin: 0 }}>行政账本</h2>
        <DatePicker picker="month" value={month} onChange={(v) => v && setMonth(v)} allowClear={false} />
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card size="small"><Statistic title={`${monthStr} 日常账单`} value={summary.daily} precision={2} prefix="¥" valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title={`${monthStr} 公司运营`} value={summary.ops} precision={2} prefix="¥" valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="本月合计" value={summary.total} precision={2} prefix="¥" /></Card></Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Tabs
          activeKey={category}
          onChange={setCategory}
          size="small"
          items={ADMIN_CATEGORIES.map((c) => ({ key: c, label: c }))}
        />
        <Permission code="admin-ledger:create">
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>记一笔</Button>
        </Permission>
      </div>

      <Table rowKey="id" loading={loading} dataSource={filtered} columns={columns} scroll={{ x: 640 }} pagination={{ pageSize: 20 }} />

      <Modal title={`记一笔 · ${category}`} open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="entryDate" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="category" label="账单类型" rules={[{ required: true }]}>
            <Select options={ADMIN_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="amount" label="支出金额" rules={[{ required: true, message: '请输入金额' }]}>
            <Input type="number" min={0.01} step={0.01} prefix="¥" />
          </Form.Item>
          <Form.Item name="remark" label="用途备注" rules={[{ required: true, message: '请说明钱用在了何处' }]}>
            <Input.TextArea rows={2} placeholder="钱用在了何处" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
