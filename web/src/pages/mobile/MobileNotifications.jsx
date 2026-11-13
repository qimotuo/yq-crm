import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Spin } from 'antd'
import { getNotifications, markNotificationRead } from '../../api/notify'
import { mapNotifyPathToMobile } from '../../utils/mobile'

export default function MobileNotifications() {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getNotifications()
      setList(res.list || [])
      setUnread(res.unread || 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleReadAll = async () => {
    await markNotificationRead()
    load()
  }

  const handleTap = async (item) => {
    if (!item.read) {
      await markNotificationRead(item.id)
      setUnread((c) => Math.max(0, c - 1))
    }
    setList((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)))
    const target = mapNotifyPathToMobile(item.path)
    if (target) navigate(target)
  }

  return (
    <div>
      {unread > 0 && (
        <div className="mobile-toolbar">
          <span>{unread} 条未读</span>
          <Button type="link" size="small" onClick={handleReadAll}>全部已读</Button>
        </div>
      )}
      <Spin spinning={loading}>
        {list.length === 0 && !loading && <div className="mobile-empty">暂无消息</div>}
        {list.map((item) => (
          <Card key={item.id} className={`mobile-card mobile-card--clickable${item.read ? '' : ' mobile-card--unread'}`}
            size="small" onClick={() => handleTap(item)}>
            <div className="mobile-card__title">
              <strong>{item.title}</strong>
              {!item.read && <span className="mobile-dot" />}
            </div>
            <p style={{ margin: '6px 0', fontSize: 13, color: '#666' }}>{item.content}</p>
            <div style={{ fontSize: 12, color: '#999' }}>{item.createTime}</div>
          </Card>
        ))}
      </Spin>
    </div>
  )
}
