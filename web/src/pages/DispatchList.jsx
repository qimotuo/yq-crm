import { useEffect, useState } from 'react'
import { Table, Button, Space, Select, Modal, Form, Input, message, Tag, Descriptions, Steps } from 'antd'
import { SendOutlined, EyeOutlined, CloseCircleOutlined, PrinterOutlined } from '@ant-design/icons'
import { getWorkOrders, dispatchWorkOrder, updateWorkOrderStatusWithReason, getInstallers } from '../api/workOrder'
import { OrderStatusTag } from '../components/StatusTag'
import ServiceOrderPrint from '../components/ServiceOrderPrint'
import { Permission } from '../components/RequireAuth'

const statusSteps = ['待派工', '已派工', '安装中', '已安装', '已完成']

export default function DispatchList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [installers, setInstallers] = useState([])
  const [dispatchModal, setDispatchModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [failModal, setFailModal] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form] = Form.useForm()
  const [failForm] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getWorkOrders({})
      setData(res.list.filter((o) => o.status !== '已完成'))
    } finally {
      setLoading(false)
    }
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
    load()
  }

  const columns = [
    { title: '工单编号', dataIndex: 'orderNo', width: 160 },
    { title: '客户名称', dataIndex: 'customerName', width: 160, ellipsis: true },
    { title: '安装地址', dataIndex: 'address', width: 180, ellipsis: true },
    { title: '安装人员', dataIndex: 'installer', width: 80, render: (v) => v || <Tag>未分配</Tag> },
    { title: '状态', dataIndex: 'status', width: 90, render: (s) => <OrderStatusTag status={s} /> },
    {
      title: '操作', width: 280, fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setCurrent(record); setDetailModal(true) }}>详情</Button>
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => { setCurrent(record); setPrintOpen(true) }}>打印</Button>
          {(record.status === '待派工' || record.status === '失败') && (
            <Permission code="workorder:dispatch">
              <Button type="link" size="small" icon={<SendOutlined />} onClick={() => { setCurrent(record); form.setFieldsValue({ installer: record.installer }); setDispatchModal(true) }}>派工</Button>
            </Permission>
          )}
          {record.status === '已派工' && (
            <Permission code="workorder:install">
              <Button type="link" size="small" onClick={() => updateWorkOrderStatusWithReason(record.id, '安装中').then(() => { message.success('已开始安装'); load() })}>开始安装</Button>
            </Permission>
          )}
          {record.status === '安装中' && (
            <Permission code="workorder:install">
              <>
                <Button type="link" size="small" onClick={() => updateWorkOrderStatusWithReason(record.id, '已安装').then(() => { message.success('安装完成'); load() })}>安装完成</Button>
                <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => { setCurrent(record); setFailModal(true) }}>失败</Button>
              </>
            </Permission>
          )}
          {record.status === '已安装' && (
            <Permission code="workorder:install">
              <Button type="link" size="small" onClick={() => updateWorkOrderStatusWithReason(record.id, '已完成').then(() => { message.success('已确认完成'); load() })}>确认完成</Button>
            </Permission>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>派工管理</h2>
        <p>派单给安装人员，跟踪状态流转</p>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1100 }} pagination={{ pageSize: 10 }} />

      <Modal title="派工" open={dispatchModal} onOk={handleDispatch} onCancel={() => setDispatchModal(false)}>
        <p>工单：<strong>{current?.orderNo}</strong></p>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="installer" label="安装人员" rules={[{ required: true }]}>
            <Select options={installers.map((i) => ({ value: i, label: i }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="安装失败" open={failModal} onOk={handleFail} onCancel={() => setFailModal(false)}>
        <Form form={failForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="failReason" label="失败原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="如：客户不在场、线路不通" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="工单详情" open={detailModal} onCancel={() => setDetailModal(false)} footer={null} width={680}>
        {current && (
          <>
            <Steps size="small" current={statusSteps.indexOf(current.status)} style={{ margin: '16px 0' }}
              items={statusSteps.map((s) => ({ title: s }))} />
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="工单号">{current.orderNo}</Descriptions.Item>
              <Descriptions.Item label="状态"><OrderStatusTag status={current.status} /></Descriptions.Item>
              <Descriptions.Item label="客户">{current.customerName}</Descriptions.Item>
              <Descriptions.Item label="安装人">{current.installer || '-'}</Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>{current.address}</Descriptions.Item>
              {current.failReason && <Descriptions.Item label="失败原因" span={2}>{current.failReason}</Descriptions.Item>}
              {current.mac && <>
                <Descriptions.Item label="MAC">{current.mac}</Descriptions.Item>
                <Descriptions.Item label="IMEI">{current.imei}</Descriptions.Item>
              </>}
            </Descriptions>
          </>
        )}
      </Modal>

      <ServiceOrderPrint open={printOpen} order={current} onClose={() => setPrintOpen(false)} />
    </div>
  )
}
