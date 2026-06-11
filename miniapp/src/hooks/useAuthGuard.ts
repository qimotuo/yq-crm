import { useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { isLoggedIn } from '@/utils/auth'

export function useAuthGuard() {
  useDidShow(() => {
    if (!isLoggedIn()) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })
}
