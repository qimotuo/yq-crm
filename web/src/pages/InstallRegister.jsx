import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, message, Descriptions, Tag, Upload, Tabs, Space } from 'antd'
import { FormOutlined, CameraOutlined, PlayCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { getMyWorkOrders, installRegister, updateWorkOrderStatusWithReason } from '../api/workOrder'
import { OrderStatusTag } from '../components/StatusTag'
import { Permission } from '../components/RequireAuth'
import { useAuth } from '../hooks/useAuth'

const TAB_STATUS = { all: null, assigned: '已派工', installing: '安装中', done: '已安装' }

export default function InstallRegister() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [tab, setTab] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [failModal, setFailModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form] = Form.useForm()
  const [failForm] = Form.useForm()
  const { user } = useAuth()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getMyWorkOrders({ installer: user.name })
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = tab === 'all' ? data : data.filter((o) => o.status === TAB_STATUS[tab])

  const openRegister = (record) => {
    setCurrent(record)
    form.setFieldsValue({
      deviceSupplier: record.deviceSupplier || '鲲鹏',
      deviceModel: record.deviceModel || '618',
      mac: record.mac,
      imei: record.imei,
      simSupplier: record.simSupplier || '光和',
      operator: record.operator || '移动',
      iccid: record.iccid,
      installRemark: record.installRemark || '',
    })
    setModalOpen(true)
  }

  const handleStart = async (record) => {
    await updateWorkOrderStatusWithReason(record.id, '安装中')
    message.success('已开始安装')
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

  const handleSubmit = async () => {
    const values = await form.validateFields()
    await installRegister(current.id, values)
    message.success('安装登记已提交')
    setModalOpen(false)
    load()
  }

  const columns = [
    { title: '工单号', dataIndex: 'orderNo', width: 150 },
    { title: '客户', dataIndex: 'customerName', width: 140, ellipsis: true },
    { title: '安装地址', dataIndex: 'address', ellipsis: true },
    { title: '联系人', dataIndex: 'contact', width: 70 },
    { title: '电话', dataIndex: 'contactPhone', width: 120 },
    { title: '预约', dataIndex: 'installDate', width: 100 },
    { title: '状态', dataIndex: 'status', width: 90, render: (s) => <OrderStatusTag status={s} /> },
    {
      title: '操作', width: 200,
      render: (_, r) => (
        <Space size="small" wrap>
          {r.status === '已派工' && (
            <Permission code="workorder:install">
              <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleStart(r)}>开始安装</Button>
            </Permission>
          )}
          {r.status === '安装中' && (
            <Permission code="workorder:install">
              <>
                <Button type="link" size="small" icon={<FormOutlined />} onClick={() => openRegister(r)}>安装登记</Button>
                <Button type="link" size="small" danger icon={<CloseCircleOutlined />}
                  onClick={() => { setCurrent(r); setFailModal(true) }}>失败</Button>
              </>
            </Permission>
          )}
          {r.status === '已安装' && <Tag color="success">已登记</Tag>}
          {r.status === '失败' && <Tag color="error">{r.failReason || '安装失败'}</Tag>}
        </Space>
      ),
    },
  ]

  const tabItems = [
    { key: 'all', label: `全部 (${data.length})` },
    { key: 'assigned', label: `待安装 (${data.filter((o) => o.status === '已派工').length})` },
    { key: 'installing', label: `安装中 (${data.filter((o) => o.status === '安装中').length})` },
    { key: 'done', label: `已安装 (${data.filter((o) => o.status === '已安装').length})` },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>我的工单 / 安装登记</h2>
        <p>查看派单、现场登记设备信息（Web 模拟小程序端）</p>
      </div>
      <Tabs activeKey={tab} onChange={setTab} items={tabItems} style={{ marginBottom: 16 }} />
      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title={`安装登记 — ${current?.orderNo}`} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={640} destroyOnClose>
        <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="客户">{current?.customerName}</Descriptions.Item>
          <Descriptions.Item label="联系人">{current?.contact} {current?.contactPhone}</Descriptions.Item>
          <Descriptions.Item label="地址" span={2}>{current?.address}</Descriptions.Item>
          <Descriptions.Item label="销售备注" span={2}>{current?.remark || '-'}</Descriptions.Item>
        </Descriptions>
        <Form form={form} layout="vertical">
          <Form.Item name="deviceSupplier" label="设备供应商" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="deviceModel" label="设备型号" rules={[{ required: true }]}><Input placeholder="如 618、华为" /></Form.Item>
          <Form.Item name="mac" label="MAC 地址" rules={[{ required: true }]}><Input placeholder="AA:BB:CC:DD:EE:01" /></Form.Item>
          <Form.Item name="imei" label="IMEI" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="simSupplier" label="卡供应商"><Input /></Form.Item>
          <Form.Item name="operator" label="运营商">
            <Select options={['移动', '电信', '联通'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="iccid" label="ICCID"><Input /></Form.Item>
          <Form.Item name="installRemark" label="安装备注"><Input.TextArea rows={2} placeholder="网络情况、是否加路由器等" /></Form.Item>
          <Form.Item label="现场照片">
            <Upload listType="picture-card" maxCount={3} beforeUpload={() => false}>
              <div><CameraOutlined /><div style={{ fontSize: 12 }}>拍照上传</div></div>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="安装失败" open={failModal} onOk={handleFail} onCancel={() => setFailModal(false)} destroyOnClose>
        <p>工单：<strong>{current?.orderNo}</strong></p>
        <Form form={failForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="failReason" label="失败原因" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="如：客户不在场、线路不通" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
