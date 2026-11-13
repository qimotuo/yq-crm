import { useState } from 'react'
import { Button, Empty, Modal, Table } from 'antd'
import { getChangeLogs } from '../api'

const columns = [
  { title: '字段', dataIndex: 'label', width: 120 },
  { title: '修改前', dataIndex: 'before', render: (v) => v || '空' },
  { title: '修改后', dataIndex: 'after', render: (v) => v || '空' },
]

export default function ChangeLogButton({ module, targetId }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState([])

  const show = async () => {
    setOpen(true)
    setLoading(true)
    try {
      const res = await getChangeLogs({ module, targetId })
      setLogs(res.list || [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button type="link" size="small" onClick={show}>修改记录</Button>
      <Modal title="修改记录" open={open} footer={null} width={760} onCancel={() => setOpen(false)} destroyOnClose>
        {loading ? <div style={{ padding: 24, textAlign: 'center' }}>加载中…</div> : null}
        {!loading && logs.length === 0 ? <Empty description="暂无修改记录" /> : null}
        {!loading && logs.map((log) => (
          <div key={log.id} style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, color: '#666' }}>{log.createdAt} · {log.userName || log.username}</div>
            <Table
              size="small"
              pagination={false}
              rowKey={(row) => `${log.id}-${row.field}`}
              dataSource={log.changes}
              columns={columns}
            />
          </div>
        ))}
      </Modal>
    </>
  )
}
