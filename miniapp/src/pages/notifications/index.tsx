import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getNotifications, markNotificationRead, type AppNotification } from '@/api/notification'
import { openNotification } from '@/utils/notificationNav'
import { isLoggedIn } from '@/utils/auth'
import './index.scss'

export default function NotificationsPage() {
  const [list, setList] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getNotifications()
      setList(res.list || [])
      setUnread(res.unread || 0)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useDidShow(() => {
    if (!isLoggedIn()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    load()
  })

  const handleReadAll = async () => {
    try {
      await markNotificationRead()
      Taro.showToast({ title: '已全部已读', icon: 'success' })
      load()
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  }

  const handleTap = (item: AppNotification) => {
    openNotification(item)
    setList((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)))
    setUnread((c) => Math.max(0, c - (item.read ? 0 : 1)))
  }

  return (
    <View className='notifications-page'>
      {unread > 0 && (
        <View className='toolbar'>
          <Text className='unread-tip'>{unread} 条未读</Text>
          <Text className='read-all' onClick={handleReadAll}>全部已读</Text>
        </View>
      )}

      {loading && <View className='empty'>加载中...</View>}
      {!loading && list.length === 0 && <View className='empty'>暂无消息</View>}

      {list.map((item) => (
        <View
          key={item.id}
          className={`card ${item.read ? '' : 'unread'}`}
          onClick={() => handleTap(item)}
        >
          <View className='card-head'>
            <Text className='type-tag'>{item.type}</Text>
            <Text className='time'>{item.time}</Text>
          </View>
          <Text className='title'>{item.title}</Text>
          <Text className='content'>{item.content}</Text>
        </View>
      ))}
    </View>
  )
}
