import { Modal } from 'antd'
import { getSchedules } from '../api/notify'
import { localToday } from './date'
import { isSales } from './mobileAuth'
import { h5Path } from './basePath'

const REMINDER_KEY = 'schedule_reminder_date'

export async function checkTodayScheduleReminder(navigate) {
  if (!isSales()) return
  const today = localToday()
  if (localStorage.getItem(REMINDER_KEY) === today) return
  try {
    const res = await getSchedules(today)
    const pending = (res.list || []).filter((s) => s.status === '待执行')
    if (pending.length === 0) return
    localStorage.setItem(REMINDER_KEY, today)
    const content = pending.slice(0, 5).map((s) => `${s.time} ${s.title}（${s.customerName}）`).join('\n')
    Modal.confirm({
      title: `今日待办 ${pending.length} 项`,
      content: content + (pending.length > 5 ? '\n...' : ''),
      okText: '查看日程',
      cancelText: '知道了',
      onOk: () => navigate(h5Path('schedules')),
    })
  } catch {
    // 静默
  }
}

export function resetScheduleReminder() {
  localStorage.removeItem(REMINDER_KEY)
}
