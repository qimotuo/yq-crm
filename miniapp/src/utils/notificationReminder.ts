import Taro from '@tarojs/taro'
import { getNotifications } from '@/api/notification'
import { isLoggedIn, isInstaller } from '@/utils/auth'
import { openNotification } from '@/utils/notificationNav'

const REMINDER_KEY = 'workorder_notify_date'

export async function checkWorkorderNotifications() {
  if (!isLoggedIn() || !isInstaller()) return
  const today = new Date().toISOString().slice(0, 10)
  if (Taro.getStorageSync(REMINDER_KEY) === today) return

  try {
    const res = await getNotifications()
    const pending = (res.list || []).filter(
      (n) => !n.read && n.templateCode === 'workorder_dispatch',
    )
    if (pending.length === 0) return

    Taro.setStorageSync(REMINDER_KEY, today)
    const first = pending[0]
    Taro.showModal({
      title: first.title || '新派工任务',
      content: first.content,
      confirmText: '查看',
      cancelText: '稍后',
      success: (r) => {
        if (r.confirm) openNotification(first)
      },
    })
  } catch {
    // silent
  }
}
