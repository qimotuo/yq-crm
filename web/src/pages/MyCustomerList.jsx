import { useEffect, useState } from 'react'
import { Table, Input, Button, Space, Tag, Modal, Form, Select, Timeline, message, Popconfirm, Dropdown, Upload } from 'antd'
import { PhoneOutlined, PlusOutlined, RollbackOutlined, WechatOutlined, FileAddOutlined, DownOutlined, DownloadOutlined, UploadOutlined, EditOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getCustomers, getFollowUps, createFollowUp, returnCustomer, updateCustomer, createCustomer, importMyCustomers, getSalesOptions, transferCustomer } from '../api'
import { downloadCsvTemplate, parseImportFile, IMPORT_ACCEPT } from '../utils/csvImport'
import { callPhone } from '../components/PhoneBar'
import { Permission } from '../components/RequireAuth'
import { ListToolbar, FilterInput, FilterSelect, QueryButton, ResetButton } from '../components/ListToolbar'
import { useAuth } from '../hooks/useAuth'
import { canFilterBySales, canManageCustomerOwner } from '../rbac/utils'
import OwnerReviewPanel from '../components/OwnerReviewPanel'
import { openCreateForm, closeFormModal } from '../utils/formModal'
import ChangeLogButton from '../components/ChangeLogButton'
import ExportButton from '../components/ExportButton'
import { useTablePagination } from '../hooks/useTablePagination'

const STATUS_COLOR = { 正常: 'success', 中断合作: 'error', 待跟进: 'warning' }
const CONTACT_STATUSES = ['正常', '中断合作', '待跟进']
const PHONE_RULE = [{ pattern: /^1\d{10}$/, message: '请输入11位手机号' }]
const MY_CUSTOMER_TEMPLATE = {
  filename: '我的客户导入模板.csv',
  headers: ['店名', '客户名称', '联系人', '手机号', '地址', '跟进方式', '跟进记录', '下次计划'],
  keys: ['storeName', 'customerName', 'contact', 'phone', 'address', 'followType', 'followContent', 'nextPlan'],
  optional: ['跟进方式', '跟进记录', '下次计划'],
  sample: ['红渡小香', '智慧社区A区物业', '小王', '13800138000', '示例地址', '电话', '已电话沟通安装意向', '2026-11-01 回访'],
  required: ['storeName', 'customerName'],
  allowFollowRow: true,
}

export default function MyCustomerList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const { pagination } = useTablePagination(10, data.length)
  const [keyword, setKeyword] = useState('')
  const [salesName, setSalesName] = useState('')
  const [followModal, setFollowModal] = useState(false)
  const [wechatModal, setWechatModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const [followUps, setFollowUps] = useState([])
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editValues, setEditValues] = useState(null)
  const [form] = Form.useForm()
  const [wechatForm] = Form.useForm()
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [salesOptions, setSalesOptions] = useState([])
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferForm] = Form.useForm()
  const { user } = useAuth()
  const navigate = useNavigate()
  const filterBySales = canFilterBySales()
  const manageOwner = canManageCustomerOwner()

  const load = async (kw = keyword, sales = salesName) => {
    setLoading(true)
    try {
      const params = {}
      if (kw) params.keyword = kw
      if (sales) params.salesName = sales
      const res = await getCustomers(params)
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setKeyword('')
    setSalesName('')
    load('', '')
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!filterBySales) return
    getSalesOptions().then((res) => setSalesOptions(res.list || [])).catch(() => setSalesOptions([]))
  }, [filterBySales])

  const openFollow = async (record) => {
    setCurrent(record)
    const res = await getFollowUps({ customerId: record.id })
    setFollowUps(res.list)
    setFollowModal(true)
  }

  const handleAddFollow = async () => {
    const values = await form.validateFields()
    await createFollowUp({
      ...values,
      customerId: current.id,
      customerName: current.customerName,
      storeName: current.storeName,
      salesName: user.name,
    })
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

  const handleTransfer = async () => {
    const values = await transferForm.validateFields()
    await transferCustomer({ id: current.id, salesName: values.salesName, reason: values.reason || '' })
    message.success('客户已转交')
    setTransferOpen(false)
    load()
  }

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    await createCustomer({ ...values, salesName: filterBySales ? values.salesName : user.name, source: '自建' })
    message.success('客户已添加')
    closeFormModal(createForm, setCreateModal)
    load()
  }

  const openEdit = (record) => {
    setCurrent(record)
    setEditValues({
      storeName: record.storeName,
      customerName: record.customerName,
      contact: record.contact,
      phone: record.phone,
      address: record.address,
    })
    setEditModal(true)
  }

  const handleEdit = async () => {
    const values = await editForm.validateFields()
    await updateCustomer(current.id, values)
    message.success('客户已更新')
    setEditModal(false)
    load()
  }

  const openCreate = () => {
    openCreateForm(createForm)
    setCreateModal(true)
  }

  const handleImport = async (file) => {
    try {
      const rows = await parseImportFile(file, MY_CUSTOMER_TEMPLATE)
      const res = await importMyCustomers(rows, user.name)
      message.success(`成功导入 ${res.count} 条客户`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const createWorkOrder = (record) => {
    navigate('/work-orders', { state: { prefill: {
      storeName: record.storeName, customerName: record.customerName,
      contact: record.contact, contactPhone: record.phone, address: record.address || '',
    } } })
  }

  const columns = [
    { title: '负责销售', dataIndex: 'salesName', width: 90 },
    { title: '店名', dataIndex: 'storeName', width: 120 },
    { title: '公司名称', dataIndex: 'customerName', width: 160 },
    { title: '联系人', dataIndex: 'contact', width: 80 },
    {
      title: '手机号', dataIndex: 'phone', width: 130,
      render: (v, r) => (
        <Permission code="my-customer:call" fallback={v}>
          <a onClick={() => callPhone(v, { customerId: r.id, customerName: r.customerName, storeName: r.storeName })}><PhoneOutlined /> {v}</a>
        </Permission>
      ),
    },
    { title: '工单号', dataIndex: 'orderNo', width: 120, render: (v) => v || '-' },
    { title: '领取时间', dataIndex: 'claimTime', width: 140, render: (v) => v || '-' },
    { title: '最近跟进', dataIndex: 'lastFollowTime', width: 140, render: (v) => v || '-' },
    {
      title: '联系状态', dataIndex: 'contactStatus', width: 100,
      render: (s, r) => (
        <Permission code="my-customer:edit" fallback={<Tag color={STATUS_COLOR[s] || 'default'}>{s}</Tag>}>
          <Dropdown menu={{
            items: CONTACT_STATUSES.map((v) => ({ key: v, label: v, onClick: () => handleStatusChange(r, v) })),
          }}>
            <Tag color={STATUS_COLOR[s] || 'default'} style={{ cursor: 'pointer' }}>{s} <DownOutlined /></Tag>
          </Dropdown>
        </Permission>
      ),
    },
    {
      title: '操作', width: 340,
      render: (_, r) => (
        <Space size="small" wrap>
          <Permission code="my-customer:edit">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          </Permission>
          {manageOwner && (
            <Button type="link" size="small" onClick={() => { setCurrent(r); transferForm.setFieldsValue({ salesName: r.salesName || undefined }); setTransferOpen(true) }}>转交</Button>
          )}
          <ChangeLogButton module="客户" targetId={r.id} />
          <Permission code="my-customer:follow">
            <Button type="link" size="small" onClick={() => openFollow(r)}>跟进</Button>
          </Permission>
          <Permission code="my-customer:wechat">
            <Button type="link" size="small" icon={<WechatOutlined />} onClick={() => openWechat(r)}>微信</Button>
          </Permission>
          <Permission code="my-customer:workorder">
            <Button type="link" size="small" icon={<FileAddOutlined />} onClick={() => createWorkOrder(r)}>建工单</Button>
          </Permission>
          <Permission code="my-customer:return">
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
      <OwnerReviewPanel onChanged={() => load()} />
      <ListToolbar
        filters={(
          <>
            <FilterInput placeholder="搜索客户/店名" value={keyword} onChange={(e) => setKeyword(e.target.value)} onPressEnter={() => load()} />
            {filterBySales && (
              <FilterSelect
                placeholder="负责销售"
                value={salesName || undefined}
                onChange={(value) => { const next = value || ''; setSalesName(next); load(keyword, next) }}
                options={salesOptions.map((item) => ({ value: item.name, label: item.name }))}
              />
            )}
            <QueryButton loading={loading} onClick={() => load()} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <>
            <Permission code="my-customer:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增客户</Button>
            </Permission>
            <Permission code="my-customer:import">
              <Button icon={<DownloadOutlined />} onClick={() => downloadCsvTemplate(MY_CUSTOMER_TEMPLATE)}>导入模板</Button>
              <Upload showUploadList={false} accept={IMPORT_ACCEPT} beforeUpload={handleImport}>
                <Button icon={<UploadOutlined />}>导入</Button>
              </Upload>
            </Permission>
            <Permission code="my-customer:export">
              <ExportButton filename="my-customers.csv" label="导出" data={data} columns={columns} />
            </Permission>
          </>
        )}
      />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={pagination} scroll={{ x: 1300 }} />

      <Modal title={`跟进记录 — ${current?.storeName || ''} ${current?.customerName || ''}`} open={followModal} onCancel={() => setFollowModal(false)} footer={null} width={640}>
        <Timeline style={{ marginTop: 16, marginBottom: 24, maxHeight: 240, overflow: 'auto' }}
          items={followUps.map((f) => ({
            children: <div>{(f.storeName || current?.storeName) && <Tag>{f.storeName || current.storeName}</Tag>} <Tag>{f.type}</Tag> {f.content}<div style={{ color: '#999', fontSize: 12 }}>{f.createTime} · 下次: {f.nextPlan || '-'}</div></div>,
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

      <Modal title="编辑客户" open={editModal} onOk={handleEdit} onCancel={() => setEditModal(false)} destroyOnClose>
        <Form key={current?.id || 'edit'} form={editForm} layout="vertical" style={{ marginTop: 16 }} preserve={false} initialValues={editValues || {}}>
          <Form.Item name="storeName" label="店名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contact" label="联系人"><Input /></Form.Item>
          <Form.Item name="phone" label="手机号" rules={PHONE_RULE}><Input maxLength={11} /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="新增客户" open={createModal} onOk={handleCreate} onCancel={() => closeFormModal(createForm, setCreateModal)} destroyOnClose>
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
          <Form.Item name="storeName" label="店名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
          {filterBySales && (
            <Form.Item name="salesName" label="负责销售" rules={[{ required: true, message: '请选择负责销售' }]}>
              <Select showSearch optionFilterProp="label" options={salesOptions.map((item) => ({ value: item.name, label: item.name }))} />
            </Form.Item>
          )}
          <Form.Item name="contact" label="联系人"><Input /></Form.Item>
          <Form.Item name="phone" label="手机号" rules={PHONE_RULE}><Input maxLength={11} /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`转交客户 — ${current?.customerName || ''}`} open={transferOpen} onOk={handleTransfer} onCancel={() => setTransferOpen(false)} destroyOnClose>
        <Form form={transferForm} layout="vertical" preserve={false}>
          <Form.Item name="salesName" label="负责销售" rules={[{ required: true, message: '请选择负责销售' }]}>
            <Select showSearch optionFilterProp="label" options={salesOptions.map((item) => ({ value: item.name, label: item.name }))} />
          </Form.Item>
          <Form.Item name="reason" label="原因"><Input /></Form.Item>
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
