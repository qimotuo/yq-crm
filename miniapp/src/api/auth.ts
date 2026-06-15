import { request } from '@/utils/request'
import type { AuthUser, Permissions } from '@/utils/auth'

export interface LoginResult {
  token: string
  user: AuthUser
  permissions: Permissions
}

export function login(username: string, password: string) {
  return request<LoginResult>('/auth/login', {
    method: 'POST',
    data: { username, password },
  })
}

export function getMe() {
  return request<{ user: AuthUser; permissions: Permissions }>('/auth/me')
}

export function wechatLogin(code: string) {
  return request<LoginResult>('/auth/wechat-login', {
    method: 'POST',
    data: { code },
  })
}

export function bindWechat(code: string) {
  return request<{ bound: boolean; openid: string }>('/auth/wechat-bind', {
    method: 'POST',
    data: { code },
  })
}
