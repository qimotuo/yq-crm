import { useEffect, useState } from 'react'
import { Table, Button, Space, Input, Tag, Modal, Form, message, Upload, Switch } from 'antd'
import { PlusOutlined, PhoneOutlined, UploadOutlined, EditOutlined, DownloadOutlined } from '@ant-design/icons'
import { getContacts, createContact, updateContact, importContacts } from '../api'
import { callPhone } from '../components/PhoneBar'
import { Permission } from '../components/RequireAuth'
import { ListToolbar, FilterInput, QueryButton, ResetButton } from '../components/ListToolbar'
import { downloadCsvTemplate, parseImportFile, IMPORT_ACCEPT } from '../utils/csvImport'
import ExportButton from '../components/ExportButton'
import { useTablePagination } from '../hooks/useTablePagination'

const CONTACT_TEMPLATE = {
  filename: '联系人导入模板.csv',
  headers: ['客户名称', '店名', '姓名', '手机号', '职务', '主联系人'],
  keys: ['customerName', 'storeName', 'name', 'phone', 'title', 'isPrimary'],
  sample: ['智慧社区A区物业', '红渡小香', '小王', '13800138000', '物业经理', '是'],
  required: ['customerName', 'name', 'phone'],
}

const PHONE_RULE = [{ pattern: /^1\d{10}$/, message: '请输入11位手机号' }]

export default function ContactList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const { pagination } = useTablePagination(10, data.length)
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  const load = async (kw = keyword) => {
    setLoading(true)
    try {
      const res = await getContacts(kw ? { keyword: kw } : {})
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setKeyword('')
    load('')
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

  const handleImport = async (file) => {
    try {
      const rows = await parseImportFile(file, CONTACT_TEMPLATE)
      const res = await importContacts(rows)
      message.success(`成功导入 ${res.count} 条联系人`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const columns = [
    { title: '客户名称', dataIndex: 'customerName', width: 160 },
    { title: '店名', dataIndex: 'storeName', width: 120 },
    { title: '姓名', dataIndex: 'name', width: 80 },
    { title: '手机号', dataIndex: 'phone', width: 130, render: (v, r) => (
      <Permission code="contact:call" fallback={v}>
        <a onClick={() => callPhone(v, { customerName: r.customerName })}><PhoneOutlined /> {v}</a>
      </Permission>
    ) },
    { title: '职务', dataIndex: 'title', width: 100 },
    { title: '主联系人', dataIndex: 'isPrimary', width: 90, render: (v) => v ? <Tag color="blue">是</Tag> : <Tag>否</Tag> },
    {
      title: '操作', width: 80,
      render: (_, r) => (
        <Permission code="contact:edit">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
        </Permission>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>联系人管理</h2>
        <p>维护客户联系人信息，支持新增、编辑、导入与外呼</p>
      </div>
      <ListToolbar
        filters={(
          <>
            <FilterInput placeholder="搜索姓名/客户/手机" value={keyword} onChange={(e) => setKeyword(e.target.value)} onPressEnter={() => load()} />
            <QueryButton loading={loading} onClick={() => load()} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <>
            <Permission code="contact:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增联系人</Button>
            </Permission>
            <Permission code="contact:import">
              <Button icon={<DownloadOutlined />} onClick={() => downloadCsvTemplate(CONTACT_TEMPLATE)}>下载模板</Button>
              <Upload showUploadList={false} accept={IMPORT_ACCEPT} beforeUpload={handleImport}>
                <Button icon={<UploadOutlined />}>导入 Excel</Button>
              </Upload>
            </Permission>
            <Permission code="contact:export">
              <ExportButton filename="contacts.csv" label="导出" data={data} columns={columns} />
            </Permission>
          </>
        )}
      />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={pagination} />

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
