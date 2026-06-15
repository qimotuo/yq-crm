import Taro from '@tarojs/taro'
import type { AppNotification } from '@/api/notification'
import { markNotificationRead } from '@/api/notification'

export async function openNotification(item: AppNotification) {
  if (!item.read) {
    try {
      await markNotificationRead(item.id)
    } catch {
      // ignore
    }
  }

  const path = item.path || ''
  if (path.startsWith('/pages/')) {
    if (path.includes('/pages/orders/') || path.includes('/pages/customers/')) {
      const tabPaths = ['/pages/orders/index', '/pages/customers/index', '/pages/profile/index']
      if (tabPaths.some((p) => path.startsWith(p) && !path.includes('?'))) {
        Taro.switchTab({ url: path.split('?')[0] })
        return
      }
    }
    Taro.navigateTo({ url: path })
    return
  }

  if (item.templateCode === 'workorder_dispatch' || item.templateCode === 'workorder_need_dispatch') {
    const m = path.match(/id=(\d+)/) || String(item.path).match(/id=(\d+)/)
    if (m) {
      Taro.navigateTo({ url: `/pages/orders/dispatch-detail?id=${m[1]}` })
      return
    }
  }
  if (item.templateCode === 'schedule_reminder') {
    Taro.navigateTo({ url: '/pages/schedules/index' })
    return
  }

  Taro.switchTab({ url: '/pages/orders/index' })
}
