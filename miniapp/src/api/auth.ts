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
