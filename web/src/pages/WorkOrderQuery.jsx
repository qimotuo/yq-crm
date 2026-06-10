import { useState } from 'react'
import { Table, Input, Button, Space, Select, Modal, Descriptions, Timeline, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { queryWorkOrders } from '../api/workOrder'
import { OrderStatusTag } from '../components/StatusTag'

const SEARCH_TYPES = [
  { value: 'keyword', label: '客户/工单号', placeholder: '客户名称、店名、工单号' },
  { value: 'mac', label: 'MAC 地址', placeholder: 'AA:BB:CC:DD:EE:01' },
  { value: 'iccid', label: 'SIM 卡号', placeholder: '89860123456789012345' },
  { value: 'deviceModel', label: '设备型号', placeholder: '618、华为、中兴' },
  { value: 'contractNo', label: '合同号', placeholder: 'SH20261105001' },
]

export default function WorkOrderQuery() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [searchType, setSearchType] = useState('keyword')
  const [keyword, setKeyword] = useState('')
  const [detail, setDetail] = useState(null)

  const handleSearch = async () => {
    if (!keyword.trim()) return
    setLoading(true)
    try {
      const params = { [searchType]: keyword.trim() }
      const res = await queryWorkOrders(params)
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  const placeholder = SEARCH_TYPES.find((t) => t.value === searchType)?.placeholder

  const columns = [
    { title: '工单号', dataIndex: 'orderNo', width: 150 },
    { title: '客户', dataIndex: 'customerName', width: 140, ellipsis: true },
    { title: '店名', dataIndex: 'storeName', width: 110 },
    { title: '安装人', dataIndex: 'installer', width: 80, render: (v) => v || <Tag>未分配</Tag> },
    { title: '设备', width: 120, render: (_, r) => r.deviceModel ? `${r.deviceSupplier || ''} ${r.deviceModel}` : '-' },
    { title: 'MAC', dataIndex: 'mac', width: 140, ellipsis: true, render: (v) => v || '-' },
    { title: 'ICCID', dataIndex: 'iccid', width: 150, ellipsis: true, render: (v) => v || '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: (s) => <OrderStatusTag status={s} /> },
    {
      title: '操作', width: 80,
      render: (_, r) => <Button type="link" size="small" onClick={() => setDetail(r)}>详情</Button>,
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>工单查询</h2>
        <p>按 MAC、SIM、设备型号、客户、工单号、合同号检索</p>
      </div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select value={searchType} onChange={setSearchType} style={{ width: 130 }}
          options={SEARCH_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <Input placeholder={placeholder} value={keyword} onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={handleSearch} style={{ width: 280 }} allowClear />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        locale={{ emptyText: '输入条件后点击查询' }} scroll={{ x: 1100 }} pagination={{ pageSize: 10 }} />

      <Modal title={`工单详情 — ${detail?.orderNo}`} open={!!detail} onCancel={() => setDetail(null)} footer={null} width={680}>
        {detail && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="状态"><OrderStatusTag status={detail.status} /></Descriptions.Item>
              <Descriptions.Item label="销售">{detail.salesName}</Descriptions.Item>
              <Descriptions.Item label="客户">{detail.customerName}</Descriptions.Item>
              <Descriptions.Item label="安装人">{detail.installer || '-'}</Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>{detail.address}</Descriptions.Item>
              <Descriptions.Item label="设备">{detail.deviceSupplier} {detail.deviceModel || '-'}</Descriptions.Item>
              <Descriptions.Item label="MAC / IMEI">{detail.mac || '-'} / {detail.imei || '-'}</Descriptions.Item>
              <Descriptions.Item label="运营商 / ICCID" span={2}>{detail.operator || '-'} / {detail.iccid || '-'}</Descriptions.Item>
            </Descriptions>
            {(detail.flowLogs?.length > 0) && (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>流转记录</div>
                <Timeline items={detail.flowLogs.map((log) => ({
                  children: (
                    <div>
                      <strong>{log.action}</strong> <span style={{ color: '#999', fontSize: 12 }}>{log.time}</span>
                      <div style={{ color: '#666' }}>{log.operator} — {log.detail}</div>
                    </div>
                  ),
                }))} />
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
