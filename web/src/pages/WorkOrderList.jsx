import { useEffect, useState } from 'react'
import { Table, Button, Space, Input, Select, Modal, Form, DatePicker, message, Popconfirm, Descriptions } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, EyeOutlined, PrinterOutlined } from '@ant-design/icons'
import { getWorkOrders, createWorkOrder, deleteWorkOrder, updateWorkOrder } from '../api/workOrder'
import { OrderStatusTag } from '../components/StatusTag'
import ServiceOrderPrint from '../components/ServiceOrderPrint'
import { Permission } from '../components/RequireAuth'

export default function WorkOrderList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [current, setCurrent] = useState(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (keyword) params.keyword = keyword
      if (statusFilter) params.status = statusFilter
      const res = await getWorkOrders(params)
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    if (values.installDate?.format) values.installDate = values.installDate.format('YYYY-MM-DD')
    if (editing) {
      await updateWorkOrder(editing.id, values)
      message.success('工单已更新')
    } else {
      await createWorkOrder(values)
      message.success('工单创建成功')
    }
    setModalOpen(false)
    load()
  }

  const handleDelete = async (id) => {
    await deleteWorkOrder(id)
    message.success('已删除')
    load()
  }

  const columns = [
    { title: '工单编号', dataIndex: 'orderNo', width: 160, fixed: 'left' },
    { title: '销售', dataIndex: 'salesName', width: 70 },
    { title: '店名', dataIndex: 'storeName', width: 120 },
    { title: '客户名称', dataIndex: 'customerName', width: 160, ellipsis: true },
    { title: '安装地址', dataIndex: 'address', width: 180, ellipsis: true },
    { title: '联系人', dataIndex: 'contact', width: 80 },
    { title: '联系电话', dataIndex: 'contactPhone', width: 120 },
    { title: '安装日期', dataIndex: 'installDate', width: 110 },
    { title: '状态', dataIndex: 'status', width: 90, render: (s) => <OrderStatusTag status={s} /> },
    {
      title: '操作', width: 180, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setCurrent(r); setDetailModal(true) }}>详情</Button>
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => { setCurrent(r); setPrintOpen(true) }}>打印</Button>
          {r.status === '待派工' && (
            <>
              <Permission code="workorder:edit">
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
              </Permission>
              <Permission code="workorder:delete">
                <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
                  <Button type="link" danger size="small">删除</Button>
                </Popconfirm>
              </Permission>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>销售派单</h2>
        <p>销售人员创建安装工单（接单）</p>
      </div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="搜索工单号/客户/店名" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
        <Select placeholder="工单状态" value={statusFilter || undefined} onChange={setStatusFilter} allowClear style={{ width: 130 }}
          options={['待派工', '已派工', '安装中', '已安装', '已完成'].map((s) => ({ value: s, label: s }))} />
        <Button type="primary" onClick={load}>查询</Button>
        <Permission code="workorder:create">
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建工单</Button>
        </Permission>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1400 }} pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />

      <Modal title={editing ? '编辑工单' : '新建安装工单'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={600} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="storeName" label="店名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="address" label="安装地址" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contact" label="联系人" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="installDate" label="预约安装日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="remark" label="安装备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="工单详情" open={detailModal} onCancel={() => setDetailModal(false)} footer={null} width={640}>
        {current && (
          <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="工单号">{current.orderNo}</Descriptions.Item>
            <Descriptions.Item label="状态"><OrderStatusTag status={current.status} /></Descriptions.Item>
            <Descriptions.Item label="客户">{current.customerName}</Descriptions.Item>
            <Descriptions.Item label="店名">{current.storeName}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>{current.address}</Descriptions.Item>
            <Descriptions.Item label="联系人">{current.contact}</Descriptions.Item>
            <Descriptions.Item label="电话">{current.contactPhone}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{current.remark || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <ServiceOrderPrint open={printOpen} order={current} onClose={() => setPrintOpen(false)} />
    </div>
  )
}
