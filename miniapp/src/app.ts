import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { checkTodayScheduleReminder } from './utils/scheduleReminder'
import { checkWorkorderNotifications } from './utils/notificationReminder'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    setTimeout(() => {
      checkTodayScheduleReminder()
      checkWorkorderNotifications()
    }, 800)
  })

  return children
}

export default App
