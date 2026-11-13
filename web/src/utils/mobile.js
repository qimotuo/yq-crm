import { hasMenuAccess } from '../rbac/utils'
import { h5Path } from './basePath'

export const MOBILE_TABS = [
  { path: h5Path('orders'), label: '工单', menuKeys: ['/install-register', '/work-orders', '/dispatch'] },
  { path: h5Path('customers'), label: '客户', menuKeys: ['/my-customers', '/public-pool'] },
  { path: h5Path('profile'), label: '我的', menuKeys: null },
]

export const MOBILE_TAB_PATHS = new Set(MOBILE_TABS.map((t) => t.path))

export const MOBILE_SUB_TITLES = {
  [h5Path('orders/dispatch')]: '派单详情',
  [h5Path('orders/detail')]: '安装登记',
  [h5Path('customers/detail')]: '客户详情',
  [h5Path('follow-ups')]: '跟进记录',
  [h5Path('schedules')]: '日程提醒',
  [h5Path('notifications')]: '消息通知',
  [h5Path('trace')]: '全链路追溯',
  [h5Path('stock/out')]: '设备出库',
  [h5Path('finance')]: '回款账单',
  [h5Path('contracts')]: '合同查看',
}

// Web 通知 path → H5 路由映射
const NOTIFY_PATH_MAP = {
  '/schedules': 'schedules',
  '/my-customers': 'customers',
  '/public-pool': 'customers',
  '/customers': 'customers',
  '/work-orders': 'orders',
  '/dispatch': 'orders',
  '/install-register': 'orders',
  '/follow-ups': 'follow-ups',
  '/stock': 'stock/out',
  '/finance': 'finance',
  '/contracts': 'contracts',
}

export function mapNotifyPathToMobile(path) {
  if (!path) return ''
  const clean = String(path).split('?')[0]
  const sub = NOTIFY_PATH_MAP[clean]
  return sub ? h5Path(sub) : ''
}

export function isMobileUserAgent() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

export function getVisibleMobileTabs(permissions) {
  return MOBILE_TABS.filter((tab) => {
    if (!tab.menuKeys) return true
    return tab.menuKeys.some((key) => hasMenuAccess(permissions, key))
  })
}

export function getMobileHomePath(permissions, user) {
  if (user?.role === 'sales' && hasMenuAccess(permissions, '/my-customers')) {
    return h5Path('customers')
  }
  if (hasMenuAccess(permissions, '/install-register') || hasMenuAccess(permissions, '/work-orders')) {
    return h5Path('orders')
  }
  const tabs = getVisibleMobileTabs(permissions)
  return tabs[0]?.path || h5Path('profile')
}
