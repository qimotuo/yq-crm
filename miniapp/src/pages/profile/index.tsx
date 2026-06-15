import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getUser, clearAuth, isLoggedIn, getPermissions, isSales, canTrace } from '@/utils/auth'
import { getMe, bindWechat } from '@/api/auth'
import { getNotifications } from '@/api/notification'
import { checkTodayScheduleReminder } from '@/utils/scheduleReminder'
import { useState } from 'react'
import type { AuthUser } from '@/utils/auth'
import './index.scss'

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  sales: '销售',
  installer: '安装人员',
  finance: '财务',
  warehouse: '仓储',
}

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(getUser())
  const [wxBound, setWxBound] = useState(false)
  const [unread, setUnread] = useState(0)
  const perms = getPermissions()

  useDidShow(async () => {
    if (!isLoggedIn()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    try {
      const res = await getMe()
      setUser(res.user)
      setWxBound(Boolean(res.user.wxBound))
    } catch {
      setUser(getUser())
    }
    try {
      const notify = await getNotifications()
      setUnread(notify.unread || 0)
    } catch {
      setUnread(0)
    }
  })

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出',
      success: (res) => {
        if (res.confirm) {
          clearAuth()
          Taro.reLaunch({ url: '/pages/login/index' })
        }
      },
    })
  }

  const handleBindWechat = async () => {
    try {
      const { code } = await Taro.login()
      if (!code) {
        Taro.showToast({ title: '获取微信授权失败', icon: 'none' })
        return
      }
      const res = await bindWechat(code)
      Taro.showToast({ title: `绑定成功 ${res.openid}`, icon: 'success' })
      setWxBound(true)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  }

  const goNotifications = () => {
    Taro.navigateTo({ url: '/pages/notifications/index' })
  }

  const goFollowUps = () => {
    Taro.navigateTo({ url: '/pages/follow-ups/index' })
  }

  const goSchedules = () => {
    Taro.navigateTo({ url: '/pages/schedules/index' })
  }

  const goTrace = () => {
    Taro.navigateTo({ url: '/pages/trace/index' })
  }

  const refreshScheduleReminder = () => {
    Taro.removeStorageSync('schedule_reminder_date')
    checkTodayScheduleReminder()
  }

  return (
    <View className='profile-page'>
      <View className='profile-header'>
        <View className='avatar'>{user?.name?.[0] || '?'}</View>
        <Text className='name'>{user?.name || '-'}</Text>
        <Text className='role'>{ROLE_LABELS[user?.role || ''] || user?.role}</Text>
      </View>

      <View className='menu-card'>
        <View className='menu-item'>
          <Text>登录账号</Text>
          <Text className='sub'>{user?.username}</Text>
        </View>
        <View className='menu-item'>
          <Text>数据权限</Text>
          <Text className='sub'>{perms?.dataScope || '-'}</Text>
        </View>
        {isSales() && (
          <View className='menu-item' onClick={goSchedules}>
            <Text>日程提醒</Text>
            <Text className='arrow'>›</Text>
          </View>
        )}
        {isSales() && (
          <View className='menu-item' onClick={refreshScheduleReminder}>
            <Text>检查今日待办</Text>
            <Text className='arrow'>›</Text>
          </View>
        )}
        <View className='menu-item' onClick={handleBindWechat}>
          <Text>绑定微信{wxBound ? '（已绑定）' : ''}</Text>
          <Text className='arrow'>›</Text>
        </View>
        <View className='menu-item' onClick={goNotifications}>
          <Text>消息通知{unread > 0 ? ` (${unread})` : ''}</Text>
          <Text className='arrow'>›</Text>
        </View>
        <View className='menu-item' onClick={goFollowUps}>
          <Text>跟进记录</Text>
          <Text className='arrow'>›</Text>
        </View>
        {canTrace() && (
          <View className='menu-item' onClick={goTrace}>
            <Text>全链路追溯</Text>
            <Text className='arrow'>›</Text>
          </View>
        )}
      </View>

      <Button className='logout-btn' onClick={handleLogout}>退出登录</Button>
    </View>
  )
}
