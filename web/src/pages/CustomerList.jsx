import { useEffect, useState } from 'react'
import { Table, Input, Button, Space, Tag, Modal, Descriptions, message } from 'antd'
import { SearchOutlined, EyeOutlined, DollarOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getCustomers } from '../api'

export default function CustomerList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')
  const [detailModal, setDetailModal] = useState(false)
  const [current, setCurrent] = useState(null)
  const navigate = useNavigate()

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

  const columns = [
    { title: '店名', dataIndex: 'storeName', width: 120, fixed: 'left' },
    { title: '客户名称', dataIndex: 'customerName', width: 160 },
    { title: '联系人', dataIndex: 'contact', width: 80 },
    { title: '手机号', dataIndex: 'phone', width: 120 },
    { title: '工单号', dataIndex: 'orderNo', width: 160 },
    { title: 'MAC', dataIndex: 'mac', width: 150 },
    { title: '运营商', dataIndex: 'operator', width: 80 },
    { title: '合同周期', dataIndex: 'contractPeriod', width: 200 },
    { title: '开票类型', dataIndex: 'invoiceType', width: 130 },
    { title: '销售', dataIndex: 'salesName', width: 80 },
    { title: '联系状态', dataIndex: 'contactStatus', width: 90, render: (s) => <Tag color={s === '正常' ? 'success' : 'error'}>{s}</Tag> },
    {
      title: '操作', width: 160, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setCurrent(r); setDetailModal(true) }}>详情</Button>
          <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => { message.info('跳转财务板块'); navigate('/finance') }}>录入回款</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>合作客户查询</h2>
        <p>客户、工单、设备、合同信息聚合视图</p>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索客户/店名/手机号" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 260 }} allowClear />
        <Button type="primary" onClick={load}>查询</Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1800 }} pagination={{ pageSize: 10 }} />

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
            <Descriptions.Item label="合同周期" span={2}>{current.contractPeriod}</Descriptions.Item>
            <Descriptions.Item label="开票类型">{current.invoiceType}</Descriptions.Item>
            <Descriptions.Item label="销售">{current.salesName}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
