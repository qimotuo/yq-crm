import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Spin } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import {
  FormOutlined, TeamOutlined, UserOutlined,
} from '@ant-design/icons'
import { useSessionCheck } from '../hooks/useAuth'
import { selectIsAuthenticated, selectPermissions, selectUser } from '../store/authSlice'
import {
  getVisibleMobileTabs, MOBILE_TAB_PATHS, MOBILE_SUB_TITLES,
} from '../utils/mobile'
import { h5Path } from '../utils/basePath'
import { checkTodayScheduleReminder } from '../utils/scheduleReminder'
import { APP_NAME_SHORT } from '../constants/app'

const TAB_ICONS = {
  [h5Path('orders')]: FormOutlined,
  [h5Path('customers')]: TeamOutlined,
  [h5Path('profile')]: UserOutlined,
}

const PAGE_TITLES = {
  [h5Path('orders')]: '安装派单',
  [h5Path('customers')]: '客户',
  [h5Path('profile')]: '我的',
}

export default function MobileLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const sessionReady = useSessionCheck()
  const permissions = useSelector(selectPermissions)
  const user = useSelector(selectUser)
  const tabs = getVisibleMobileTabs(permissions)
  const isTabPage = MOBILE_TAB_PATHS.has(location.pathname)

  useEffect(() => {
    if (isAuthenticated && sessionReady && isTabPage) {
      checkTodayScheduleReminder(navigate)
    }
  }, [isAuthenticated, sessionReady, isTabPage, navigate])

  if (!isAuthenticated) {
    return <Navigate to={h5Path('login')} replace state={{ from: location.pathname }} />
  }
  if (!sessionReady) {
    return (
      <div className="mobile-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin />
      </div>
    )
  }

  const title = isTabPage
    ? (PAGE_TITLES[location.pathname] || APP_NAME_SHORT)
    : (() => {
      if (location.pathname === h5Path('orders/dispatch')) {
        const mode = new URLSearchParams(location.search).get('mode')
        const id = new URLSearchParams(location.search).get('id')
        return mode === 'create' || !id ? '发安装单' : '派单详情'
      }
      return MOBILE_SUB_TITLES[location.pathname] || '详情'
    })()

  return (
    <div className="mobile-layout">
      <header className="mobile-header">
        {!isTabPage && (
          <button type="button" className="mobile-header__back" onClick={() => navigate(-1)} aria-label="返回">
            <ArrowLeftOutlined />
          </button>
        )}
        <span className="mobile-header__title">{title}</span>
      </header>
      <main className={`mobile-content${isTabPage ? '' : ' mobile-content--sub'}`}>
        <Outlet />
      </main>
      {isTabPage && (
        <nav className="mobile-tabbar">
          {tabs.map((tab) => {
            const Icon = TAB_ICONS[tab.path]
            const active = location.pathname === tab.path
            return (
              <button
                key={tab.path}
                type="button"
                className={`mobile-tabbar__item${active ? ' mobile-tabbar__item--active' : ''}`}
                onClick={() => navigate(tab.path)}
              >
                <Icon />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
