import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getSchedules, completeSchedule, type Schedule } from '@/api/schedule'
import { isLoggedIn, isSales } from '@/utils/auth'
import { todayStr } from '@/utils/date'
import './index.scss'

const TYPE_CLASS: Record<string, string> = {
  上门: 'type-visit',
  电话: 'type-call',
  安装: 'type-install',
}

export default function SchedulesPage() {
  const [list, setList] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)
  const today = todayStr()

  const load = async () => {
    setLoading(true)
    try {
      const res = await getSchedules()
      setList(res.list || [])
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
    if (!isSales()) {
      Taro.showToast({ title: '日程功能面向销售角色', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 600)
      return
    }
    load()
  })

  const todayPending = list.filter((s) => s.date === today && s.status === '待执行')

  const handleComplete = async (id: number) => {
    try {
      await completeSchedule(id)
      Taro.showToast({ title: '已完成', icon: 'success' })
      load()
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  }

  return (
    <View className='schedules-page'>
      {todayPending.length > 0 && (
        <View className='today-banner'>
          <Text className='banner-title'>今日待办 {todayPending.length} 项</Text>
          {todayPending.map((s) => (
            <Text key={s.id} className='banner-item'>{s.time} {s.title} · {s.customerName}</Text>
          ))}
        </View>
      )}

      {loading && <View className='empty'>加载中...</View>}
      {!loading && list.length === 0 && <View className='empty'>暂无日程</View>}

      {list.map((s) => (
        <View key={s.id} className='card'>
          <View className='card-head'>
            <Text className='card-title'>{s.title}</Text>
            <Text className={`type-tag ${TYPE_CLASS[s.type] || ''}`}>{s.type}</Text>
          </View>
          <View className='card-row'><Text className='label'>客户</Text><Text>{s.customerName}</Text></View>
          <View className='card-row'><Text className='label'>时间</Text><Text>{s.date} {s.time}</Text></View>
          <View className='card-row'>
            <Text className='label'>状态</Text>
            <Text className={s.status === '已完成' ? 'status-done-text' : 'status-pending-text'}>{s.status}</Text>
          </View>
          {s.status === '待执行' && (
            <Button className='btn-primary complete-btn' size='mini' onClick={() => handleComplete(s.id)}>
              标记完成
            </Button>
          )}
        </View>
      ))}
    </View>
  )
}
