import { useEffect, useState } from 'react'
import { Table, Input, Button, Space, Tag, Progress } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { getIntegratedList } from '../api'
import { PaymentStatusTag } from '../components/StatusTag'
import { formatMoney } from '../utils/helpers'

export default function IntegratedQuery() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await getIntegratedList(keyword ? { keyword } : {})
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const columns = [
    { title: '门店', dataIndex: 'storeName', width: 110, fixed: 'left' },
    { title: '客户', dataIndex: 'customerName', width: 150 },
    { title: '销售', dataIndex: 'salesName', width: 70 },
    { title: '联系状态', dataIndex: 'contactStatus', width: 90, render: (s) => <Tag color={s === '正常' ? 'success' : 'error'}>{s}</Tag> },
    { title: '账单月', dataIndex: 'billMonth', width: 80 },
    { title: '应收', dataIndex: 'totalAmount', width: 90, render: formatMoney },
    { title: '已收', dataIndex: 'paidAmount', width: 90, render: formatMoney },
    { title: '未收', dataIndex: 'unpaidAmount', width: 90, render: (v) => <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>{formatMoney(v)}</span> },
    { title: '回款状态', dataIndex: 'paymentStatus', width: 90, render: (s) => <PaymentStatusTag status={s} /> },
    { title: '进度', dataIndex: 'paymentProgress', width: 100, render: (v, r) => <Progress percent={Math.round((r.paidAmount / r.totalAmount) * 100) || 0} size="small" /> },
    { title: '开票', dataIndex: 'invoiceStatus', width: 80 },
    { title: 'MAC', dataIndex: 'mac', width: 140 },
    { title: '工单号', dataIndex: 'orderNo', width: 150 },
    { title: '资产健康', dataIndex: 'assetHealth', width: 90, render: (s) => <Tag color={s === '离线预警' ? 'error' : 'success'}>{s}</Tag> },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>销售+财务+工单关联查询</h2>
        <p>跨模块统一视图，一表看清客户全貌</p>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索客户/工单/门店" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 260 }} allowClear />
        <Button type="primary" onClick={load}>查询</Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1800 }} pagination={{ pageSize: 10 }} />
    </div>
  )
}
