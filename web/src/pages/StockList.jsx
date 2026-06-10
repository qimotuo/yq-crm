import { useEffect, useState } from 'react'
import { Table, Tabs, Tag, Alert, Button, Modal, Form, Select, Input, message, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getStockIn, getSimStockIn, getStockOut, createStockOut } from '../api'
import { getWorkOrders } from '../api/workOrder'
import { Permission } from '../components/RequireAuth'
import { useAuth } from '../hooks/useAuth'

export default function StockList() {
  const [loading, setLoading] = useState(false)
  const [inData, setInData] = useState([])
  const [simData, setSimData] = useState([])
  const [outData, setOutData] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const [form] = Form.useForm()
  const { user } = useAuth()

  const load = () => {
    setLoading(true)
    Promise.all([getStockIn(), getSimStockIn(), getStockOut()])
      .then(([inRes, simRes, outRes]) => {
        setInData(inRes.list)
        setSimData(simRes.list)
        setOutData(outRes.list)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(); getWorkOrders({}).then((r) => setOrders(r.list)) }, [])

  const lowStock = simData.filter((s) => s.stockQty <= 5)

  const openOut = () => {
    form.resetFields()
    setModalOpen(true)
  }

  const handleOut = async () => {
    const values = await form.validateFields()
    const order = orders.find((o) => o.orderNo === values.orderNo)
    await createStockOut({
      ...values,
      storeName: order?.storeName || '',
      customerName: order?.customerName || '',
      address: order?.address || '',
      receiver: user.name || '张三',
    })
    message.success('出库成功，库存已扣减')
    setModalOpen(false)
    load()
  }

  const inColumns = [
    { title: '入库单号', dataIndex: 'inNo', width: 150 },
    { title: '入库日期', dataIndex: 'inDate', width: 110 },
    { title: '供应商', dataIndex: 'supplier', width: 80 },
    { title: '设备型号', dataIndex: 'model', width: 100 },
    { title: 'IMEI', dataIndex: 'imei', width: 150 },
    { title: 'MAC', dataIndex: 'mac', width: 150 },
    { title: '数量', dataIndex: 'qty', width: 60 },
    { title: '库存余量', dataIndex: 'stockQty', width: 90, render: (v) => v <= 5 ? <Tag color="error">{v}</Tag> : v },
    { title: '领用人', dataIndex: 'receiver', width: 80 },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
  ]

  const simColumns = [
    { title: '入库单号', dataIndex: 'inNo', width: 150 },
    { title: '入库日期', dataIndex: 'inDate', width: 110 },
    { title: '运营商', dataIndex: 'operator', width: 100 },
    { title: 'ICCID', dataIndex: 'iccid', width: 200 },
    { title: '库存余量', dataIndex: 'stockQty', width: 90, render: (v) => v <= 5 ? <Tag color="error">{v} ⚠️</Tag> : v },
    { title: '领用人', dataIndex: 'receiver', width: 80 },
  ]

  const outColumns = [
    { title: '出库单号', dataIndex: 'outNo', width: 150 },
    { title: '出库日期', dataIndex: 'outDate', width: 110 },
    { title: '工单号', dataIndex: 'orderNo', width: 160 },
    { title: '客户门店', dataIndex: 'storeName', width: 120 },
    { title: '设备型号', dataIndex: 'model', width: 100 },
    { title: 'MAC', dataIndex: 'mac', width: 150 },
    { title: 'ICCID', dataIndex: 'iccid', width: 180 },
    { title: '运营商', dataIndex: 'operator', width: 100 },
    { title: '领用人', dataIndex: 'receiver', width: 80 },
  ]

  const outTab = (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Permission code="stock:out">
          <Button type="primary" icon={<PlusOutlined />} onClick={openOut}>新增出库</Button>
        </Permission>
      </Space>
      <Table columns={outColumns} dataSource={outData} rowKey="id" loading={loading} scroll={{ x: 1200 }} pagination={false} />
    </>
  )

  const items = [
    { key: 'in', label: '设备入库', children: <Table columns={inColumns} dataSource={inData} rowKey="id" loading={loading} scroll={{ x: 1200 }} pagination={false} /> },
    { key: 'sim', label: <span>SIM 卡入库 {lowStock.length > 0 && <Tag color="error">{lowStock.length} 项预警</Tag>}</span>, children: (
      <>
        {lowStock.length > 0 && <Alert type="warning" message={`${lowStock.length} 项 SIM 卡库存低于阈值（≤5）`} style={{ marginBottom: 16 }} showIcon />}
        <Table columns={simColumns} dataSource={simData} rowKey="id" loading={loading} scroll={{ x: 900 }} pagination={false} />
      </>
    ) },
    { key: 'out', label: '设备出库', children: outTab },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>设备出入库</h2>
        <p>入库、出库关联工单，库存自动扣减</p>
      </div>
      <Tabs items={items} />

      <Modal title="新增出库单" open={modalOpen} onOk={handleOut} onCancel={() => setModalOpen(false)} width={560} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="orderNo" label="关联工单" rules={[{ required: true }]}>
            <Select placeholder="选择工单" showSearch options={orders.map((o) => ({ value: o.orderNo, label: `${o.orderNo} - ${o.customerName}` }))} />
          </Form.Item>
          <Form.Item name="model" label="设备型号" rules={[{ required: true }]}><Input placeholder="鲲鹏618" /></Form.Item>
          <Form.Item name="mac" label="MAC" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="iccid" label="ICCID"><Input /></Form.Item>
          <Form.Item name="operator" label="运营商">
            <Select options={['中国移动', '中国电信', '中国联通'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
