import store from '../store'
import { selectPermissions, selectUser } from '../store/authSlice'
import { hasMenuAccess } from '../rbac/utils'

export function getMobileUser() {
  return selectUser(store.getState())
}

export function getMobilePermissions() {
  return selectPermissions(store.getState())
}

export function hasOperation(code) {
  const perms = getMobilePermissions()
  if (!perms?.operations) return false
  return perms.operations.includes('*') || perms.operations.includes(code)
}

export function isSales() {
  return getMobileUser()?.role === 'sales'
}

export function isInstaller() {
  return getMobileUser()?.role === 'installer'
}

export function canDispatch() {
  return hasOperation('workorder:dispatch') || hasOperation('dispatch:assign')
}

export function canTrace() {
  return hasOperation('trace:view') || hasOperation('customer:view') || hasOperation('my-customer:view') || hasOperation('workorder:view') || hasOperation('install:view')
}

export function canViewFinance() {
  return hasOperation('finance:view')
}

export function canViewContract() {
  return hasOperation('contract:view')
}

export function hasMenu(path) {
  return hasMenuAccess(getMobilePermissions(), path)
}
