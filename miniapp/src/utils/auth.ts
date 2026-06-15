import Taro from '@tarojs/taro'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'
const PERMS_KEY = 'permissions'

export interface AuthUser {
  id: number
  username: string
  name: string
  role: string
  enabled: boolean
  wxBound?: boolean
}

export interface Permissions {
  menuKeys: string[]
  operations: string[]
  dataScope: string
}

export function getToken(): string {
  return Taro.getStorageSync(TOKEN_KEY) || ''
}

export function getUser(): AuthUser | null {
  return Taro.getStorageSync(USER_KEY) || null
}

export function getPermissions(): Permissions | null {
  return Taro.getStorageSync(PERMS_KEY) || null
}

export function saveAuth(token: string, user: AuthUser, permissions?: Permissions) {
  Taro.setStorageSync(TOKEN_KEY, token)
  Taro.setStorageSync(USER_KEY, user)
  if (permissions) {
    Taro.setStorageSync(PERMS_KEY, permissions)
  }
}

export function clearAuth() {
  Taro.removeStorageSync(TOKEN_KEY)
  Taro.removeStorageSync(USER_KEY)
  Taro.removeStorageSync(PERMS_KEY)
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

export function hasOperation(code: string): boolean {
  const perms = getPermissions()
  if (!perms) return false
  return perms.operations.includes(code) || perms.operations.includes('*')
}

export function getHomeTab(): string {
  const user = getUser()
  if (user?.role === 'sales') return '/pages/customers/index'
  return '/pages/orders/index'
}

export function isSales(): boolean {
  return getUser()?.role === 'sales'
}

export function isInstaller(): boolean {
  return getUser()?.role === 'installer'
}

export function canDispatch(): boolean {
  return hasOperation('workorder:dispatch')
}

export function canTrace(): boolean {
  return hasOperation('trace:view') || hasOperation('customer:view') || hasOperation('workorder:view')
}

export function canViewFinance(): boolean {
  return hasOperation('finance:view')
}

export function canViewContract(): boolean {
  return hasOperation('contract:view')
}

export function isAdmin(): boolean {
  return getUser()?.role === 'admin'
}
