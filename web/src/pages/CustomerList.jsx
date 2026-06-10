import { useEffect, useState } from 'react'
import { Table, Input, Button, Space, Tag, Modal, Descriptions, Form, Select, message, Popconfirm } from 'antd'
import { SearchOutlined, EyeOutlined, DollarOutlined, PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, getFinanceList, getPaymentRecords, recordPayment } from '../api'
import { formatMoney } from '../utils/helpers'
import PaymentModal from '../components/PaymentModal'
import { Permission } from '../components/RequireAuth'

export default function CustomerList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')
  const [detailModal, setDetailModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [historyModal, setHistoryModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const [financeRecord, setFinanceRecord] = useState(null)
  const [paymentRecords, setPaymentRecords] = useState([])
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getCustomers(keyword ? { keyword } : {})
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openEdit = (record) => {
    setCurrent(record)
    form.setFieldsValue(record || { contactStatus: '正常', invoiceType: '增值税普通发票' })
    setEditModal(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    if (current?.id) {
      await updateCustomer(current.id, values)
      message.success('客户已更新')
    } else {
      await createCustomer(values)
      message.success('客户已新增')
    }
    setEditModal(false)
    load()
  }

  const handleDelete = async (id) => {
    await deleteCustomer(id)
    message.success('已删除')
    load()
  }

  const openPayment = async (record) => {
    if (!record.financeId && !record.orderNo) {
      message.warning('该客户暂无关联财务账单')
      return
    }
    const params = record.financeId ? { id: record.financeId } : { orderNo: record.orderNo }
    const res = await getFinanceList(params)
    if (!res.list.length) {
      message.warning('未找到财务账单')
      return
    }
    setFinanceRecord(res.list[0])
    setPayModal(true)
  }

  const handlePay = async (values) => {
    await recordPayment({ id: financeRecord.id, ...values })
    message.success('回款录入成功')
    setPayModal(false)
    load()
  }

  const openHistory = async (record) => {
    if (!record.financeId) {
      message.info('暂无回款记录')
      return
    }
    const res = await getPaymentRecords(record.financeId)
    setPaymentRecords(res.list)
    setCurrent(record)
    setHistoryModal(true)
  }

  const columns = [
    { title: '店名', dataIndex: 'storeName', width: 120, fixed: 'left' },
    { title: '客户名称', dataIndex: 'customerName', width: 160 },
    { title: '联系人', dataIndex: 'contact', width: 80 },
    { title: '手机号', dataIndex: 'phone', width: 120 },
    { title: '工单号', dataIndex: 'orderNo', width: 160 },
    { title: '安装日期', dataIndex: 'installDate', width: 110, render: (v) => v || '-' },
    { title: 'MAC', dataIndex: 'mac', width: 150, render: (v) => v || '-' },
    { title: '合同周期', dataIndex: 'contractPeriod', width: 200 },
    { title: '最近回款', width: 120, render: (_, r) => r.lastPaymentTime ? `${r.lastPaymentTime} ¥${r.lastPaymentAmount}` : '-' },
    { title: '开票类型', dataIndex: 'invoiceType', width: 130 },
    { title: '销售', dataIndex: 'salesName', width: 80 },
    { title: '联系状态', dataIndex: 'contactStatus', width: 90, render: (s) => <Tag color={s === '正常' ? 'success' : 'error'}>{s}</Tag> },
    {
      title: '操作', width: 280, fixed: 'right',
      render: (_, r) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setCurrent(r); setDetailModal(true) }}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Permission code="finance:payment">
            <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => openPayment(r)}>录入回款</Button>
          </Permission>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => openHistory(r)}>回款记录</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>合作客户查询</h2>
        <p>客户、工单、设备、合同、财务信息聚合视图</p>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索客户/店名/手机号" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 260 }} allowClear />
        <Button type="primary" onClick={load}>查询</Button>
        <Button icon={<PlusOutlined />} onClick={() => { setCurrent(null); openEdit(null) }}>新增客户</Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 2000 }} pagination={{ pageSize: 10 }} />

      <Modal title={`客户详情 — ${current?.customerName}`} open={detailModal} onCancel={() => setDetailModal(false)} footer={null} width={720}>
        {current && (
          <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="店名">{current.storeName}</Descriptions.Item>
            <Descriptions.Item label="客户">{current.customerName}</Descriptions.Item>
            <Descriptions.Item label="联系人">{current.contact}</Descriptions.Item>
            <Descriptions.Item label="手机">{current.phone}</Descriptions.Item>
            <Descriptions.Item label="工单号">{current.orderNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="安装日期">{current.installDate || '-'}</Descriptions.Item>
            <Descriptions.Item label="设备">{current.deviceSupplier} {current.deviceModel}</Descriptions.Item>
            <Descriptions.Item label="MAC">{current.mac || '-'}</Descriptions.Item>
            <Descriptions.Item label="IMEI">{current.imei || '-'}</Descriptions.Item>
            <Descriptions.Item label="ICCID">{current.iccid || '-'}</Descriptions.Item>
            <Descriptions.Item label="运营商">{current.operator || '-'}</Descriptions.Item>
            <Descriptions.Item label="SIM供应商">{current.simSupplier || '-'}</Descriptions.Item>
            <Descriptions.Item label="合同周期" span={2}>{current.contractPeriod}</Descriptions.Item>
            <Descriptions.Item label="开票类型">{current.invoiceType}</Descriptions.Item>
            <Descriptions.Item label="销售">{current.salesName}</Descriptions.Item>
            <Descriptions.Item label="最近回款">{current.lastPaymentTime ? `${current.lastPaymentTime} · ${formatMoney(current.lastPaymentAmount)}` : '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal title={current?.id ? '编辑客户' : '新增客户'} open={editModal} onOk={handleSave} onCancel={() => setEditModal(false)} width={560}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="storeName" label="店名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contact" label="联系人" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="手机号" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="salesName" label="销售"><Input /></Form.Item>
          <Form.Item name="invoiceType" label="开票类型">
            <Select options={['增值税专用发票', '增值税普通发票', '不开发票', '待开票'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="contactStatus" label="联系状态">
            <Select options={['正常', '中断合作'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      <PaymentModal open={payModal} record={financeRecord} onCancel={() => setPayModal(false)} onSubmit={handlePay} />

      <Modal title={`回款记录 — ${current?.customerName}`} open={historyModal} onCancel={() => setHistoryModal(false)} footer={null}>
        {paymentRecords.length ? paymentRecords.map((p) => (
          <p key={p.id}>{p.time} · {formatMoney(p.amount)} · {p.voucher || '无凭证'} · {p.verified ? '已核销' : '待核销'}</p>
        )) : <p>暂无回款记录</p>}
      </Modal>
    </div>
  )
}
