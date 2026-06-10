import { useEffect, useState } from 'react'
import { Table, Input, Button, Space, Tag, message, Popconfirm, Upload, Modal, Form } from 'antd'
import { SearchOutlined, UserAddOutlined, UploadOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons'
import { getPublicPool, claimCustomer, importPublicPool, createPublicPoolCustomer } from '../api'
import { Permission } from '../components/RequireAuth'

const PHONE_RULE = [{ pattern: /^1\d{10}$/, message: '请输入11位手机号' }]

export default function PublicPoolList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getPublicPool(keyword ? { keyword } : {})
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleClaim = async (id) => {
    await claimCustomer(id)
    message.success('领取成功，已加入「我的客户」')
    load()
  }

  const handleImport = async () => {
    const res = await importPublicPool()
    message.success(`成功导入 ${res.count} 条客户`)
    load()
  }

  const handleCreate = async () => {
    const values = await form.validateFields()
    await createPublicPoolCustomer(values)
    message.success('公海客户已添加')
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const downloadTemplate = () => {
    const header = '店名,客户名称,联系人,手机号,地址\n'
    const blob = new Blob([header + '示例门店,示例客户,张经理,13800138000,示例地址'], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = '公海客户导入模板.csv'
    a.click()
  }

  const columns = [
    { title: '店名', dataIndex: 'storeName', width: 140 },
    { title: '客户名称', dataIndex: 'customerName', width: 180 },
    { title: '联系人', dataIndex: 'contact', width: 100 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '地址', dataIndex: 'address', ellipsis: true },
    { title: '来源', dataIndex: 'source', width: 80, render: (s) => <Tag>{s}</Tag> },
    { title: '状态', dataIndex: 'status', width: 90, render: () => <Tag color="blue">在公海</Tag> },
    {
      title: '操作', width: 100,
      render: (_, r) => (
        <Permission code="customer:claim">
          <Popconfirm title="确认领取该客户？" onConfirm={() => handleClaim(r.id)}>
            <Button type="link" size="small" icon={<UserAddOutlined />}>领取</Button>
          </Popconfirm>
        </Permission>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>公海客户</h2>
        <p>销售可从公海池领取潜在客户，支持手动新增与 Excel 导入</p>
      </div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="搜索客户/店名" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
        <Button type="primary" onClick={load}>查询</Button>
        <Permission code="customer:create">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增客户</Button>
        </Permission>
        <Permission code="customer:import">
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>下载模板</Button>
          <Upload showUploadList={false} beforeUpload={() => { handleImport(); return false }}>
            <Button icon={<UploadOutlined />}>导入 Excel</Button>
          </Upload>
        </Permission>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="新增公海客户" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="storeName" label="店名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contact" label="联系人"><Input /></Form.Item>
          <Form.Item name="phone" label="手机号" rules={PHONE_RULE}><Input maxLength={11} /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
