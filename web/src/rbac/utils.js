import { MENU_TREE, ALL_MENU_KEYS } from './config'
import store from '../store'
import { updatePermissions } from '../store/authSlice'

export function getCurrentUser() {
  return store.getState().auth.user || {}
}

export function getCurrentPermissions() {
  return store.getState().auth.permissions || {}
}

export function savePermissions(permissions) {
  store.dispatch(updatePermissions(permissions))
}

/** 检查操作权限 */
export function hasPermission(code) {
  const perms = getCurrentPermissions()
  if (!code) return true
  if (perms.operations?.includes('*')) return true
  return perms.operations?.includes(code) ?? false
}

/** 检查菜单权限 */
export function hasMenuAccess(permissions, path) {
  if (!path) return false
  if (permissions.menuKeys?.includes('*')) return true
  return permissions.menuKeys?.includes(path) ?? false
}

export function hasMenu(path) {
  return hasMenuAccess(getCurrentPermissions(), path)
}

/** 按优先级返回当前用户可访问的第一个菜单路径 */
export function resolveMenuPath(permissions, paths) {
  const list = Array.isArray(paths) ? paths : [paths]
  return list.find((p) => hasMenuAccess(permissions, p)) || null
}

/** 获取数据权限范围 */
export function getDataScope() {
  return getCurrentPermissions().dataScope || 'SELF'
}

/** 是否仅本人数据 */
export function isSelfDataOnly() {
  return getDataScope() === 'SELF'
}

/** 管理员，以及数据权限为全部的主管 */
export function canManageCustomerOwner() {
  const perms = getCurrentPermissions()
  return perms.operations?.includes('*') || getDataScope() === 'ALL'
}

/** 主管/管理员可按销售筛选；销售本人不筛选他人 */
export function canFilterBySales() {
  return canManageCustomerOwner() || getDataScope() === 'DEPT'
}

/** 过滤菜单树 */
export function filterMenuTree(tree, menuKeys) {
  const allowed = menuKeys?.includes('*') ? ALL_MENU_KEYS : (menuKeys || [])
  const hasAccess = (key) => key.startsWith('/') ? allowed.includes(key) : true

  return tree.reduce((acc, node) => {
    if (node.children) {
      const children = node.children.filter((c) => allowed.includes(c.key))
      if (children.length > 0) acc.push({ ...node, children })
    } else if (hasAccess(node.key)) {
      acc.push(node)
    }
    return acc
  }, [])
}

/** 扁平化菜单 keys */
export function flattenMenuKeys(menuKeys) {
  if (menuKeys?.includes('*')) return ALL_MENU_KEYS
  return menuKeys || []
}

/** 格式化角色权限为展示文本 */
export function formatRoleSummary(role) {
  const menuCount = role.menuKeys?.includes('*') ? '全部' : `${role.menuKeys?.length || 0} 项`
  const opCount = role.operations?.includes('*') ? '全部' : `${role.operations?.length || 0} 项`
  const scopeMap = { ALL: '全部数据', SELF: '仅本人', ASSIGNED: '仅分配', DEPT: '本部门' }
  return { menuCount, opCount, dataScopeLabel: scopeMap[role.dataScope] || role.dataScope }
}

export { MENU_TREE, ALL_MENU_KEYS }
