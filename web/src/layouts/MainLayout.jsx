import { Navigate, Outlet } from 'react-router-dom'
import { Layout, Menu, Dropdown, Space, Spin, theme } from 'antd'
import {
  DashboardOutlined, FileTextOutlined, SendOutlined, TeamOutlined, DollarOutlined,
  InboxOutlined, UserOutlined, LogoutOutlined, GlobalOutlined, FormOutlined,
  LinkOutlined, SearchOutlined, SettingOutlined, UserSwitchOutlined, CalendarOutlined,
  ContactsOutlined, SafetyOutlined, FileProtectOutlined, HistoryOutlined, DatabaseOutlined, FileSearchOutlined,
  BellOutlined, AccountBookOutlined, AuditOutlined, RobotOutlined, PhoneOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import NotificationBell from '../components/NotificationBell'
import PhoneBar from '../components/PhoneBar'
import AiAssistant from '../components/AiAssistant'
import { AgentContextProvider } from '../context/AgentContext'
import { useAuth, useSessionCheck } from '../hooks/useAuth'
import { MENU_TREE, DEFAULT_ROLES } from '../rbac/config'
import { filterMenuTree } from '../rbac/utils'
import { selectIsAuthenticated, selectPermissions, selectUser } from '../store/authSlice'
import { UserAvatar } from '../pages/Profile'
import { APP_NAME } from '../constants/app'

function checkPermission(permissions, code) {
  if (permissions.operations?.includes('*')) return true
  return permissions.operations?.includes(code) ?? false
}

const { Header, Sider, Content } = Layout

const ICON_MAP = {
  '/dashboard': <DashboardOutlined />,
  '/ai-agent': <RobotOutlined />,
  '/public-pool': <GlobalOutlined />,
  '/pool-config': <DatabaseOutlined />,
  '/my-customers': <UserSwitchOutlined />,
  '/contacts': <ContactsOutlined />,
  '/follow-ups': <HistoryOutlined />,
  '/schedules': <CalendarOutlined />,
  '/work-orders': <FileTextOutlined />,
  '/stock': <InboxOutlined />,
  '/dispatch': <SendOutlined />,
  '/install-register': <FormOutlined />,
  '/work-order-query': <FileSearchOutlined />,
  '/customers': <TeamOutlined />,
  '/finance': <DollarOutlined />,
  '/account-ledger': <AccountBookOutlined />,
  '/admin-ledger': <AuditOutlined />,
  '/contracts': <FileProtectOutlined />,
  '/integrated': <LinkOutlined />,
  '/report-trace': <SearchOutlined />,
  '/system/users': <SettingOutlined />,
  '/system/roles': <SafetyOutlined />,
  '/system/notifications': <BellOutlined />,
  '/system/call-logs': <PhoneOutlined />,
  '/system/cti-config': <PhoneOutlined />,
  '/system/print-template': <FileTextOutlined />,
  '/system/logs': <FileSearchOutlined />,
}

function toMenuItems(tree) {
  return tree.map((node) => {
    if (node.children) {
      return {
        key: node.key,
        label: node.label,
        children: node.children.map((c) => ({ key: c.key, icon: ICON_MAP[c.key], label: c.label })),
      }
    }
    return { key: node.key, icon: ICON_MAP[node.key], label: node.label }
  })
}

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken()
  const user = useSelector(selectUser)
  const permissions = useSelector(selectPermissions)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const sessionReady = useSessionCheck()
  const { logout } = useAuth()
  const roleName = DEFAULT_ROLES.find((r) => r.code === user.role)?.name || user.role

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!sessionReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin />
      </div>
    )
  }

  const menuItems = toMenuItems(filterMenuTree(MENU_TREE, permissions.menuKeys))
  const openKeys = menuItems.filter((m) => m.children?.some((c) => c.key === location.pathname)).map((m) => m.key)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <AgentContextProvider>
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={64} theme="dark" width={220}>
        <div style={{
          minHeight: 64, padding: '12px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.35, textAlign: 'center',
        }}>
          {APP_NAME}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} defaultOpenKeys={openKeys}
          items={menuItems} onClick={({ key }) => { if (key.startsWith('/')) navigate(key) }}
          style={{ height: 'calc(100vh - 64px)', overflow: 'auto' }} />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Space size={20}>
            <NotificationBell />
            <Dropdown menu={{ items: [
              { key: 'profile', icon: <UserOutlined />, label: '个人信息', onClick: () => navigate('/profile') },
              { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
            ]}}>
              <Space style={{ cursor: 'pointer' }}>
                <UserAvatar src={user.avatar} size={32} />
                <span>{user.nickname || user.name}（{roleName}）</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 24 }}>
          <div style={{ padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG, minHeight: 360 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
      {(checkPermission(permissions, 'my-customer:call') || checkPermission(permissions, 'contact:call')) && <PhoneBar />}
      <AiAssistant />
    </Layout>
    </AgentContextProvider>
  )
}
