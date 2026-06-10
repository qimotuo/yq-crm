import { useEffect, useState } from 'react'
import { Badge, Dropdown, List, Tag, Empty } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getNotifications, markNotificationRead } from '../api/notify'

const typeColor = { 工单: 'blue', 财务: 'gold', 库存: 'orange', 日程: 'purple', 合同: 'cyan', 付费: 'red', 系统: 'default' }

export default function NotificationBell() {
  const [unread, setUnread] = useState(0)
  const [list, setList] = useState([])
  const navigate = useNavigate()

  const load = () => {
    getNotifications().then((res) => { setList(res.list); setUnread(res.unread) })
  }

  useEffect(() => { load() }, [])

  const handleClick = async (item) => {
    if (!item.read) {
      await markNotificationRead(item.id)
      load()
    }
    if (item.path) navigate(item.path)
  }

  const handleReadAll = async () => {
    await markNotificationRead()
    load()
  }

  const popupRender = () => (
    <div style={{ width: 360, background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
        <strong>消息通知</strong>
        {unread > 0 && <a onClick={handleReadAll}>全部已读</a>}
      </div>
      {list.length === 0 ? <Empty style={{ padding: 24 }} /> : (
        <List style={{ maxHeight: 360, overflow: 'auto' }} dataSource={list}
          renderItem={(item) => (
            <List.Item style={{ padding: '10px 16px', cursor: 'pointer', background: item.read ? '#fff' : '#f6ffed' }}
              onClick={() => handleClick(item)}>
              <List.Item.Meta
                title={<span><Tag color={typeColor[item.type]} style={{ marginRight: 8 }}>{item.type}</Tag>{item.title}{!item.read && <Badge status="processing" style={{ marginLeft: 8 }} />}</span>}
                description={<div><div style={{ fontSize: 12 }}>{item.content}</div><div style={{ color: '#999', fontSize: 11, marginTop: 4 }}>{item.time}</div></div>}
              />
            </List.Item>
          )} />
      )}
    </div>
  )

  return (
    <Dropdown popupRender={popupRender} trigger={['click']} placement="bottomRight">
      <Badge count={unread} size="small">
        <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
      </Badge>
    </Dropdown>
  )
}
