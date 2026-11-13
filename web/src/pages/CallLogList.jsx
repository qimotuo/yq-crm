import { useEffect, useState } from 'react'
import { Table, Tag, message } from 'antd'
import { getCallLogs } from '../api/cti'
import { ListToolbar, FilterInput, QueryButton, ResetButton } from '../components/ListToolbar'
import ExportButton from '../components/ExportButton'
import { Permission } from '../components/RequireAuth'
import { useTablePagination } from '../hooks/useTablePagination'

export default function CallLogList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const { pagination } = useTablePagination(10, data.length)
  const [keyword, setKeyword] = useState('')

  const load = async (kw = keyword) => {
    setLoading(true)
    try {
      const res = await getCallLogs(kw ? { keyword: kw } : {})
      setData(res.list || [])
    } catch (e) {
      message.error(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const columns = [
    { title: '开始时间', dataIndex: 'startedAt', width: 170 },
    { title: '号码', dataIndex: 'phone', width: 130 },
    { title: '客户', dataIndex: 'customerName', width: 160, render: (v) => v || '-' },
    { title: '销售', dataIndex: 'userName', width: 90 },
    { title: '模式', dataIndex: 'mode', width: 100, render: (v) => <Tag>{v}</Tag> },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (s) => <Tag color={s === 'calling' ? 'processing' : 'default'}>{s === 'calling' ? '通话中' : '已结束'}</Tag>,
    },
    {
      title: '时长', dataIndex: 'duration', width: 90,
      render: (d) => `${String(Math.floor((d || 0) / 60)).padStart(2, '0')}:${String((d || 0) % 60).padStart(2, '0')}`,
    },
    { title: '厂商单号', dataIndex: 'providerRef', ellipsis: true, render: (v) => v || '-' },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>通话记录</h2>
        <p>外呼电话条产生的通话留痕，可按号码 / 客户检索</p>
      </div>
      <ListToolbar
        filters={(
          <>
            <FilterInput placeholder="号码 / 客户 / 销售" value={keyword} onChange={(e) => setKeyword(e.target.value)} onPressEnter={() => load()} />
            <QueryButton loading={loading} onClick={() => load()} />
            <ResetButton onClick={() => { setKeyword(''); load('') }} />
          </>
        )}
        actions={(
          <Permission code="call-log:export">
            <ExportButton filename="call-logs.csv" label="导出" data={data} columns={columns} />
          </Permission>
        )}
      />
      <Table rowKey="id" loading={loading} columns={columns} dataSource={data} pagination={pagination} />
    </div>
  )
}
