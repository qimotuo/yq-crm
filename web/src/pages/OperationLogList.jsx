import { useEffect, useState } from 'react'
import { Table, Input, Select, Space, Tag } from 'antd'
import { getOperationLogs } from '../api/notify'

const actionColors = {
  login: 'green',
  query: 'blue',
  create: 'cyan',
  update: 'orange',
  delete: 'red',
  dispatch: 'purple',
  install: 'geekblue',
}

export default function OperationLogList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [action, setAction] = useState('')
  const [module, setModule] = useState('')

  const load = (p = page) => {
    setLoading(true)
    const params = { page: p, size: 20 }
    if (keyword) params.keyword = keyword
    if (action) params.action = action
    if (module) params.module = module
    getOperationLogs(params)
      .then((res) => {
        setData(res.list)
        setTotal(res.total)
        setPage(res.page)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [])

  const columns = [
    { title: '时间', dataIndex: 'createdAt', width: 170 },
    { title: '用户', width: 140, render: (_, r) => `${r.userName}（${r.username}）` },
    {
      title: '操作',
      dataIndex: 'action',
      width: 90,
      render: (a, r) => <Tag color={actionColors[a] || 'default'}>{r.actionLabel}</Tag>,
    },
    { title: '模块', dataIndex: 'module', width: 80 },
    { title: '详情', dataIndex: 'detail', ellipsis: true },
    { title: 'IP', dataIndex: 'ip', width: 120 },
    { title: '接口', dataIndex: 'path', width: 180, ellipsis: true },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>操作日志</h2>
        <p>记录用户在系统中的登录、查询、派工、接单等操作</p>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索用户/详情"
          allowClear
          style={{ width: 220 }}
          onSearch={(v) => { setKeyword(v); load(1) }}
        />
        <Select
          allowClear
          placeholder="操作类型"
          style={{ width: 120 }}
          onChange={(v) => { setAction(v || ''); setTimeout(() => load(1)) }}
          options={[
            { value: 'login', label: '登录' },
            { value: 'query', label: '查询' },
            { value: 'create', label: '新增' },
            { value: 'update', label: '修改' },
            { value: 'delete', label: '删除' },
            { value: 'dispatch', label: '派工' },
            { value: 'install', label: '安装登记' },
          ]}
        />
        <Select
          allowClear
          placeholder="模块"
          style={{ width: 120 }}
          onChange={(v) => { setModule(v || ''); setTimeout(() => load(1)) }}
          options={['系统', '工单', '日程'].map((v) => ({ value: v, label: v }))}
        />
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: (p) => load(p),
          showTotal: (t) => `共 ${t} 条`,
        }}
      />
    </div>
  )
}
