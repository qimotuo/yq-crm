import Taro from '@tarojs/taro'
import { getToken, clearAuth } from './auth'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface RequestOptions {
  method?: Method
  data?: Record<string, unknown>
  header?: Record<string, string>
}

export async function request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken()
  const res = await Taro.request({
    url: `${API_BASE}${url}`,
    method: options.method || 'GET',
    data: options.data,
    header: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.header,
    },
  })

  const json = res.data as { code: number; message?: string; data: T }
  if (json.code !== 200) {
    if (json.code === 401) {
      clearAuth()
      Taro.reLaunch({ url: '/pages/login/index' })
    }
    throw new Error(json.message || '请求失败')
  }
  return json.data
}
