import { useEffect, useState } from 'react'
import { Table, Button, Space, Input, Select, Tag, Modal, Descriptions, message } from 'antd'
import { SearchOutlined, PrinterOutlined, FileAddOutlined } from '@ant-design/icons'
import { getContracts, generateContract } from '../api'
import { formatMoney } from '../utils/helpers'

export default function ContractList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detail, setDetail] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (keyword) params.keyword = keyword
      if (statusFilter) params.status = statusFilter
      const res = await getContracts(params)
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async (orderNo) => {
    await generateContract(orderNo)
    message.success('合同已生成')
    load()
  }

  const statusColor = { 正常: 'success', 即将到期: 'warning', 待生成: 'default' }

  const columns = [
    { title: '合同编号', dataIndex: 'contractNo', width: 150 },
    { title: '工单号', dataIndex: 'orderNo', width: 160 },
    { title: '客户', dataIndex: 'customerName', width: 160 },
    { title: '门店', dataIndex: 'storeName', width: 120 },
    { title: '套餐', dataIndex: 'package', width: 160 },
    { title: '金额', dataIndex: 'amount', width: 100, render: formatMoney },
    { title: '合同周期', width: 200, render: (_, r) => `${r.startDate} ~ ${r.endDate}` },
    { title: '状态', dataIndex: 'status', width: 100, render: (s) => <Tag color={statusColor[s]}>{s}</Tag> },
    {
      title: '操作', width: 180, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => setDetail(r)}>查看</Button>
          {r.status === '待生成' && (
            <Button type="link" size="small" icon={<FileAddOutlined />} onClick={() => handleGenerate(r.orderNo)}>生成合同</Button>
          )}
          {r.status !== '待生成' && (
            <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => { setDetail(r); message.info('演示：打开打印对话框') }}>打印</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>合同管理</h2>
        <p>安装完成第 8 天自动生成合同，支持打印</p>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索合同号/工单/客户" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
        <Select placeholder="合同状态" value={statusFilter || undefined} onChange={setStatusFilter} allowClear style={{ width: 120 }}
          options={['正常', '即将到期', '待生成'].map((s) => ({ value: s, label: s }))} />
        <Button type="primary" onClick={load}>查询</Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1400 }} pagination={{ pageSize: 10 }} />

      <Modal title={`合同详情 — ${detail?.contractNo}`} open={!!detail} onCancel={() => setDetail(null)} footer={null} width={560}>
        {detail && (
          <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="合同编号">{detail.contractNo}</Descriptions.Item>
            <Descriptions.Item label="工单号">{detail.orderNo}</Descriptions.Item>
            <Descriptions.Item label="客户">{detail.customerName}</Descriptions.Item>
            <Descriptions.Item label="门店">{detail.storeName}</Descriptions.Item>
            <Descriptions.Item label="套餐">{detail.package}</Descriptions.Item>
            <Descriptions.Item label="金额">{formatMoney(detail.amount)}</Descriptions.Item>
            <Descriptions.Item label="起始">{detail.startDate}</Descriptions.Item>
            <Descriptions.Item label="截止">{detail.endDate}</Descriptions.Item>
            <Descriptions.Item label="城市代码">{detail.cityCode}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColor[detail.status]}>{detail.status}</Tag></Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
