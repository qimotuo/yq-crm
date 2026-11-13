import { useEffect, useState } from 'react'
import { Table, Button, Space, Select, Modal, Form, Input, message, Tag, Descriptions, Steps, Timeline, Tabs } from 'antd'
import { SendOutlined, EyeOutlined, CloseCircleOutlined, PrinterOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons'
import WorkOrderFormModal, { useWorkOrderForm } from '../components/WorkOrderFormModal'
import { getWorkOrders, dispatchWorkOrder, updateWorkOrderStatusWithReason, getInstallers } from '../api/workOrder'
import { OrderStatusTag } from '../components/StatusTag'
import ServiceOrderPrint from '../components/ServiceOrderPrint'
import { Permission } from '../components/RequireAuth'
import ExportButton from '../components/ExportButton'
import { ListToolbar, FilterInput, FilterSelect, QueryButton, ResetButton } from '../components/ListToolbar'
import { useTablePagination } from '../hooks/useTablePagination'

const statusSteps = ['待派工', '已派工', '安装中', '已安装', '已完成']
const STEP_ALIAS = { 安装成功: '安装中', 推迟安装: '已派工', 失败: '已派工' }
const STATUS_OPTIONS = ['', '待派工', '已派工', '推迟安装', '安装中', '安装成功', '已安装', '失败'].map((s) => ({ value: s, label: s || '全部状态' }))

export default function DispatchList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const { pagination } = useTablePagination(10, data.length)
  const [installers, setInstallers] = useState([])
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dispatchModal, setDispatchModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [failModal, setFailModal] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form] = Form.useForm()
  const [failForm] = Form.useForm()
  const { modalOpen, editing, openCreate, openEdit, closeModal } = useWorkOrderForm()

  const load = async (opts = {}) => {
    const kw = opts.keyword ?? keyword
    const status = opts.status ?? statusFilter
    setLoading(true)
    try {
      const params = {}
      if (kw) params.keyword = kw
      if (status) params.status = status
      const res = await getWorkOrders(params)
      setData(res.list.filter((o) => o.status !== '已完成' && o.status !== '已取消'))
    } finally {
      setLoading(false)
    }
  }

  const onStatusChange = (v) => {
    const status = v || ''
    setStatusFilter(status)
    load({ keyword, status })
  }

  const handleReset = () => {
    setKeyword('')
    setStatusFilter('')
    load({ keyword: '', status: '' })
  }

  useEffect(() => { load(); getInstallers().then(setInstallers) }, [])

  const handleDispatch = async () => {
    const values = await form.validateFields()
    await dispatchWorkOrder(current.id, values.installer)
    message.success('派工成功')
    setDispatchModal(false)
    load()
  }

  const handleFail = async () => {
    const values = await failForm.validateFields()
    await updateWorkOrderStatusWithReason(current.id, '失败', values.failReason)
    message.warning('已标记安装失败')
    setFailModal(false)
    failForm.resetFields()
    load()
  }

  const columns = [
    { title: '工单编号', dataIndex: 'orderNo', width: 160 },
    { title: '销售', dataIndex: 'salesName', width: 70 },
    { title: '客户名称', dataIndex: 'customerName', width: 150, ellipsis: true },
    { title: '安装地址', dataIndex: 'address', width: 160, ellipsis: true },
    { title: '预约日期', dataIndex: 'installDate', width: 110 },
    { title: '安装人员', dataIndex: 'installer', width: 80, render: (v) => v || <Tag>未分配</Tag> },
    { title: '状态', dataIndex: 'status', width: 90, render: (s) => <OrderStatusTag status={s} /> },
    {
      title: '操作', width: 300, fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setCurrent(record); setDetailModal(true) }}>详情</Button>
          <Permission code="dispatch:print">
            <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => { setCurrent(record); setPrintOpen(true) }}>打印</Button>
          </Permission>
          {record.status === '待派工' && (
            <Permission code="dispatch:edit">
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
            </Permission>
          )}
          {(record.status === '待派工' || record.status === '失败') && (
            <Permission code="dispatch:assign">
              <Button type="link" size="small" icon={<SendOutlined />} onClick={() => { setCurrent(record); form.setFieldsValue({ installer: record.installer }); setDispatchModal(true) }}>派工</Button>
            </Permission>
          )}
          {record.status === '已安装' && (
            <Permission code="dispatch:confirm">
              <Button type="link" size="small" onClick={() => updateWorkOrderStatusWithReason(record.id, '已完成').then(() => { message.success('已确认完成'); load() })}>确认完成</Button>
            </Permission>
          )}
        </Space>
      ),
    },
  ]

  const detailContent = current && (
    <Tabs items={[
      {
        key: 'info',
        label: '基本信息',
        children: (
          <>
            <Steps size="small" current={Math.max(0, statusSteps.indexOf(STEP_ALIAS[current.status] || current.status))} style={{ margin: '8px 0 16px' }}
              items={statusSteps.map((s) => ({ title: s }))} />
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="工单号">{current.orderNo}</Descriptions.Item>
              <Descriptions.Item label="状态"><OrderStatusTag status={current.status} /></Descriptions.Item>
              <Descriptions.Item label="销售">{current.salesName}</Descriptions.Item>
              <Descriptions.Item label="安装人">{current.installer || '-'}</Descriptions.Item>
              <Descriptions.Item label="客户">{current.customerName}</Descriptions.Item>
              <Descriptions.Item label="店名">{current.storeName}</Descriptions.Item>
              <Descriptions.Item label="联系人">{current.contact} / {current.contactPhone}</Descriptions.Item>
              <Descriptions.Item label="预约日期">{current.installDate || current.installTimeSlot || '-'}</Descriptions.Item>
              <Descriptions.Item label="价格">{current.price || '-'}</Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>{current.address}</Descriptions.Item>
              <Descriptions.Item label="销售备注" span={2}>{current.remark || '-'}</Descriptions.Item>
              {current.failReason && <Descriptions.Item label="失败原因" span={2}>{current.failReason}</Descriptions.Item>}
              {current.mac && <>
                <Descriptions.Item label="设备">{current.deviceSupplier} {current.deviceModel}</Descriptions.Item>
                <Descriptions.Item label="MAC / IMEI">{current.mac} / {current.imei}</Descriptions.Item>
                <Descriptions.Item label="SIM" span={2}>{current.operator} / {current.iccid || '-'}{current.backupIccid ? ` / 备用 ${current.backupIccid}` : ''}</Descriptions.Item>
                <Descriptions.Item label="安装备注" span={2}>{current.installRemark || '-'}</Descriptions.Item>
              </>}
            </Descriptions>
          </>
        ),
      },
      {
        key: 'flow',
        label: '流转记录',
        children: (
          <Timeline style={{ marginTop: 16 }}
            items={(current.flowLogs || []).map((log) => ({
              children: (
                <div>
                  <div><strong>{log.action}</strong> <span style={{ color: '#999', fontSize: 12 }}>{log.time}</span></div>
                  <div style={{ color: '#666' }}>{log.operator} — {log.detail}</div>
                </div>
              ),
            }))}
          />
        ),
      },
    ]} />
  )

  return (
    <div>
      <div className="page-header">
        <h2>派工管理</h2>
        <p>派单给安装人员，跟踪流转记录与状态</p>
      </div>
      <ListToolbar
        filters={(
          <>
            <FilterInput placeholder="工单号 / 客户 / 店名" value={keyword} onChange={(e) => setKeyword(e.target.value)} onPressEnter={() => load()} />
            <FilterSelect value={statusFilter} onChange={onStatusChange} options={STATUS_OPTIONS} />
            <QueryButton loading={loading} onClick={() => load()} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <>
            <Permission code="dispatch:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建工单</Button>
            </Permission>
            <Permission code="dispatch:export">
              <ExportButton filename="dispatch.csv" label="导出" data={data} columns={columns} />
            </Permission>
          </>
        )}
      />
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1200 }} pagination={pagination} />

      <Modal title="派工" open={dispatchModal} onOk={handleDispatch} onCancel={() => setDispatchModal(false)} destroyOnClose>
        <p>工单：<strong>{current?.orderNo}</strong> — {current?.customerName}</p>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="installer" label="安装人员" rules={[{ required: true, message: '请选择安装人员' }]}>
            <Select placeholder="选择安装工程师" options={installers.map((i) => ({ value: i, label: i }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="安装失败" open={failModal} onOk={handleFail} onCancel={() => setFailModal(false)} destroyOnClose>
        <Form form={failForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="failReason" label="失败原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="如：客户不在场、线路不通" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`工单详情 — ${current?.orderNo}`} open={detailModal} onCancel={() => setDetailModal(false)} footer={null} width={720}>
        {detailContent}
      </Modal>

      <ServiceOrderPrint open={printOpen} order={current} onClose={() => setPrintOpen(false)} />

      <WorkOrderFormModal open={modalOpen} editing={editing} onCancel={closeModal} onSuccess={load} />
    </div>
  )
}
