import { useEffect, useState } from 'react'
import { Table, Input, Button, Tag, message, Popconfirm, Upload, Modal, Form } from 'antd'
import { UserAddOutlined, UploadOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons'
import { getPublicPool, claimCustomer, importPublicPool, createPublicPoolCustomer } from '../api'
import { downloadCsvTemplate, parseImportFile, IMPORT_ACCEPT } from '../utils/csvImport'
import { Permission } from '../components/RequireAuth'
import ExportButton from '../components/ExportButton'
import { ListToolbar, FilterInput, QueryButton, ResetButton } from '../components/ListToolbar'
import { openCreateForm, closeFormModal } from '../utils/formModal'
import { useTablePagination } from '../hooks/useTablePagination'

const PHONE_RULE = [{ pattern: /^1\d{10}$/, message: '请输入11位手机号' }]
const POOL_TEMPLATE = {
  filename: '公海客户导入模板.csv',
  headers: ['店名', '客户名称', '联系人', '手机号', '地址'],
  keys: ['storeName', 'customerName', 'contact', 'phone', 'address'],
  sample: ['示例门店', '示例客户', '张经理', '13800138000', '示例地址'],
  required: ['storeName', 'customerName'],
}

export default function PublicPoolList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const { pagination } = useTablePagination(10, data.length)
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const load = async (kw = keyword) => {
    setLoading(true)
    try {
      const res = await getPublicPool(kw ? { keyword: kw } : {})
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

  const handleClaim = async (id) => {
    await claimCustomer(id)
    message.success('领取成功，已加入「我的客户」')
    load()
  }

  const handleImport = async (file) => {
    try {
      const rows = await parseImportFile(file, POOL_TEMPLATE)
      const res = await importPublicPool(rows)
      message.success(`成功导入 ${res.count} 条客户`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const handleCreate = async () => {
    const values = await form.validateFields()
    await createPublicPoolCustomer(values)
    message.success('公海客户已添加')
    closeFormModal(form, setModalOpen)
    load()
  }

  const openCreate = () => {
    openCreateForm(form)
    setModalOpen(true)
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
        <Permission code="public-pool:claim">
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
      <ListToolbar
        filters={(
          <>
            <FilterInput placeholder="搜索客户/店名" value={keyword} onChange={(e) => setKeyword(e.target.value)} onPressEnter={() => load()} />
            <QueryButton loading={loading} onClick={() => load()} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <>
            <Permission code="public-pool:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增客户</Button>
            </Permission>
            <Permission code="public-pool:import">
              <Button icon={<DownloadOutlined />} onClick={() => downloadCsvTemplate(POOL_TEMPLATE)}>下载模板</Button>
              <Upload showUploadList={false} accept={IMPORT_ACCEPT} beforeUpload={handleImport}>
                <Button icon={<UploadOutlined />}>导入 Excel</Button>
              </Upload>
            </Permission>
            <Permission code="public-pool:export">
              <ExportButton filename="public-pool.csv" label="导出" data={data} columns={columns} />
            </Permission>
          </>
        )}
      />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={pagination} />

      <Modal title="新增公海客户" open={modalOpen} onOk={handleCreate} onCancel={() => closeFormModal(form, setModalOpen)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
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
