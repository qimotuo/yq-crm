import { useEffect, useState } from 'react'
import { Table, Button, Space, Input, Tag, Modal, Form, message, Upload, Switch } from 'antd'
import { PlusOutlined, SearchOutlined, PhoneOutlined, UploadOutlined, EditOutlined } from '@ant-design/icons'
import { getContacts, createContact, updateContact, importContacts } from '../api'
import { callPhone } from '../components/PhoneBar'
import { Permission } from '../components/RequireAuth'

const PHONE_RULE = [{ pattern: /^1\d{10}$/, message: '请输入11位手机号' }]

export default function ContactList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getContacts(keyword ? { keyword } : {})
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (record) => { setEditing(record); form.setFieldsValue(record); setModalOpen(true) }

  const handleSave = async () => {
    const values = await form.validateFields()
    if (editing) {
      await updateContact({ ...values, id: editing.id })
      message.success('联系人已更新')
    } else {
      await createContact(values)
      message.success('联系人已添加')
    }
    setModalOpen(false)
    form.resetFields()
    load()
  }

  const handleImport = async () => {
    const res = await importContacts()
    message.success(`成功导入 ${res.count} 条联系人`)
    load()
  }

  const columns = [
    { title: '客户名称', dataIndex: 'customerName', width: 160 },
    { title: '店名', dataIndex: 'storeName', width: 120 },
    { title: '姓名', dataIndex: 'name', width: 80 },
    { title: '手机号', dataIndex: 'phone', width: 130, render: (v) => <a onClick={() => callPhone(v)}><PhoneOutlined /> {v}</a> },
    { title: '职务', dataIndex: 'title', width: 100 },
    { title: '主联系人', dataIndex: 'isPrimary', width: 90, render: (v) => v ? <Tag color="blue">是</Tag> : <Tag>否</Tag> },
    {
      title: '操作', width: 80,
      render: (_, r) => <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>联系人管理</h2>
        <p>维护客户联系人信息，支持新增、编辑、导入与外呼</p>
      </div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="搜索姓名/客户/手机" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
        <Button type="primary" onClick={load}>查询</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增联系人</Button>
        <Permission code="customer:import">
          <Upload showUploadList={false} beforeUpload={() => { handleImport(); return false }}>
            <Button icon={<UploadOutlined />}>导入 Excel</Button>
          </Upload>
        </Permission>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title={editing ? '编辑联系人' : '新增联系人'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="storeName" label="店名"><Input /></Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true }, ...PHONE_RULE]}><Input maxLength={11} /></Form.Item>
          <Form.Item name="title" label="职务"><Input /></Form.Item>
          <Form.Item name="isPrimary" label="主联系人" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
