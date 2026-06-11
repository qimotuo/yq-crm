import Taro from '@tarojs/taro'
import { getSchedules } from '@/api/schedule'
import { todayStr } from '@/utils/date'
import { isLoggedIn, isSales } from '@/utils/auth'

const REMINDER_KEY = 'schedule_reminder_date'

export async function checkTodayScheduleReminder() {
  if (!isLoggedIn() || !isSales()) return
  const today = todayStr()
  if (Taro.getStorageSync(REMINDER_KEY) === today) return

  try {
    const res = await getSchedules(today)
    const pending = (res.list || []).filter((s) => s.status === '待执行')
    if (pending.length === 0) return

    Taro.setStorageSync(REMINDER_KEY, today)
    const content = pending
      .slice(0, 5)
      .map((s) => `${s.time} ${s.title}（${s.customerName}）`)
      .join('\n')
    Taro.showModal({
      title: `今日待办 ${pending.length} 项`,
      content: content + (pending.length > 5 ? '\n...' : ''),
      confirmText: '查看日程',
      cancelText: '知道了',
      success: (r) => {
        if (r.confirm) {
          Taro.navigateTo({ url: '/pages/schedules/index' })
        }
      },
    })
  } catch {
    // 静默失败，不打扰用户
  }
}
