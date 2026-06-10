import { useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, Select, message, Descriptions, Tag, Upload } from 'antd'
import { FormOutlined, CameraOutlined } from '@ant-design/icons'
import { getMyWorkOrders, installRegister } from '../api/workOrder'
import { OrderStatusTag } from '../components/StatusTag'

export default function InstallRegister() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [current, setCurrent] = useState(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getMyWorkOrders({})
      setData(res.list.filter((o) => ['已派工', '安装中', '已安装'].includes(o.status)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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

  const handleSubmit = async () => {
    const values = await form.validateFields()
    await installRegister(current.id, { ...values, status: '已安装' })
    message.success('安装登记已提交')
    setModalOpen(false)
    load()
  }

  const columns = [
    { title: '工单号', dataIndex: 'orderNo', width: 160 },
    { title: '客户', dataIndex: 'customerName', width: 160 },
    { title: '安装地址', dataIndex: 'address', ellipsis: true },
    { title: '联系人', dataIndex: 'contact', width: 80 },
    { title: '电话', dataIndex: 'contactPhone', width: 120 },
    { title: '状态', dataIndex: 'status', width: 90, render: (s) => <OrderStatusTag status={s} /> },
    {
      title: '操作', width: 120,
      render: (_, r) => r.status !== '已安装' ? (
        <Button type="link" size="small" icon={<FormOutlined />} onClick={() => openRegister(r)}>安装登记</Button>
      ) : <Tag color="success">已登记</Tag>,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>安装工单登记</h2>
        <p>安装人员填写现场设备信息、网络情况（模拟小程序端）</p>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title={`安装登记 — ${current?.orderNo}`} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={640} destroyOnClose>
        <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="客户">{current?.customerName}</Descriptions.Item>
          <Descriptions.Item label="地址">{current?.address}</Descriptions.Item>
        </Descriptions>
        <Form form={form} layout="vertical">
          <Form.Item name="deviceSupplier" label="设备供应商" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="deviceModel" label="设备型号" rules={[{ required: true }]}><Input /></Form.Item>
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
    </div>
  )
}
