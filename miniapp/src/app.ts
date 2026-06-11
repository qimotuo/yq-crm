import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { checkTodayScheduleReminder } from './utils/scheduleReminder'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    setTimeout(() => checkTodayScheduleReminder(), 800)
  })

  return children
}

export default App
