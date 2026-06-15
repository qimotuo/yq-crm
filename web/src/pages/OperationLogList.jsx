import { useEffect, useState } from 'react'
import { Table, Tag } from 'antd'
import { getOperationLogs } from '../api/notify'
import { ListToolbar, FilterInput, FilterSelect, QueryButton, ResetButton } from '../components/ListToolbar'

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
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [action, setAction] = useState('')
  const [module, setModule] = useState('')
  const [query, setQuery] = useState({ keyword: '', action: '', module: '' })

  const load = (p = page, q = query) => {
    setLoading(true)
    const params = { page: p, size: 20 }
    if (q.keyword) params.keyword = q.keyword
    if (q.action) params.action = q.action
    if (q.module) params.module = q.module
    getOperationLogs(params)
      .then((res) => {
        setData(res.list)
        setTotal(res.total)
        setPage(res.page)
      })
      .finally(() => setLoading(false))
  }

  const searchWith = (next) => {
    setQuery(next)
    load(1, next)
  }

  const onSelectFilter = (key) => (v) => {
    const value = v || ''
    const next = { keyword, action, module, [key]: value }
    if (key === 'action') setAction(value)
    if (key === 'module') setModule(value)
    searchWith(next)
  }

  const handleSearch = () => searchWith({ keyword, action, module })

  const handleReset = () => {
    setKeyword('')
    setAction('')
    setModule('')
    const empty = { keyword: '', action: '', module: '' }
    setQuery(empty)
    load(1, empty)
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

      <ListToolbar
        filters={(
          <>
            <FilterInput placeholder="搜索用户/详情" value={keyword} onChange={(e) => setKeyword(e.target.value)} onPressEnter={handleSearch} />
            <FilterSelect
              placeholder="操作类型"
              value={action || undefined}
              onChange={onSelectFilter('action')}
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
            <FilterSelect
              placeholder="模块"
              value={module || undefined}
              onChange={onSelectFilter('module')}
              options={['系统', '工单', '日程'].map((v) => ({ value: v, label: v }))}
            />
            <QueryButton loading={loading} onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
          </>
        )}
      />

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
