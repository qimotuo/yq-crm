import { useEffect, useState } from 'react'
import { Table, Input, Button, Space, Tag, message, Popconfirm, Upload } from 'antd'
import { SearchOutlined, UserAddOutlined, UploadOutlined } from '@ant-design/icons'
import { getPublicPool, claimCustomer, importPublicPool } from '../api'
import { Permission } from '../components/RequireAuth'

export default function PublicPoolList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [keyword, setKeyword] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await getPublicPool(keyword ? { keyword } : {})
      setData(res.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleClaim = async (id) => {
    await claimCustomer(id)
    message.success('领取成功，已加入「我的客户」')
    load()
  }

  const handleImport = async () => {
    const res = await importPublicPool()
    message.success(`成功导入 ${res.count} 条客户`)
    load()
  }

  const columns = [
    { title: '店名', dataIndex: 'storeName', width: 140 },
    { title: '客户名称', dataIndex: 'customerName', width: 180 },
    { title: '联系人', dataIndex: 'contact', width: 100 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '地址', dataIndex: 'address', ellipsis: true },
    { title: '来源', dataIndex: 'source', width: 80, render: (s) => <Tag>{s}</Tag> },
    { title: '状态', dataIndex: 'status', width: 90, render: () => <Tag color="blue">在公海</Tag> },
    {
      title: '操作', width: 100,
      render: (_, r) => (
        <Permission code="customer:claim">
          <Popconfirm title="确认领取该客户？" onConfirm={() => handleClaim(r.id)}>
            <Button type="link" size="small" icon={<UserAddOutlined />}>领取</Button>
          </Popconfirm>
        </Permission>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>公海客户</h2>
        <p>销售可从公海池领取潜在客户，支持 Excel 导入</p>
      </div>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索客户/店名" prefix={<SearchOutlined />} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 240 }} allowClear />
        <Button type="primary" onClick={load}>查询</Button>
        <Permission code="customer:import">
          <Upload showUploadList={false} beforeUpload={() => { handleImport(); return false }}>
            <Button icon={<UploadOutlined />}>导入 Excel</Button>
          </Upload>
        </Permission>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
    </div>
  )
}
