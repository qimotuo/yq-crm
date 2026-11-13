import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Avatar, Tag, Button, Divider } from 'antd'
import { UserOutlined, LogoutOutlined, RightOutlined } from '@ant-design/icons'
import { useAuth } from '../../hooks/useAuth'
import { DEFAULT_ROLES, ROLE_COLORS } from '../../rbac/config'
import { APP_NAME_SHORT } from '../../constants/app'
import { getMe } from '../../api/auth'
import { getNotifications } from '../../api/notify'
import { hasMenu, canTrace, canViewFinance, canViewContract } from '../../utils/mobileAuth'
import { h5Path } from '../../utils/basePath'
import { checkTodayScheduleReminder, resetScheduleReminder } from '../../utils/scheduleReminder'
import { selectPermissions } from '../../store/authSlice'
import { useSelector } from 'react-redux'

export default function MobileProfile() {
  const navigate = useNavigate()
  const permissions = useSelector(selectPermissions)
  const { user, logout } = useAuth()
  const [profile, setProfile] = useState(user)
  const [unread, setUnread] = useState(0)
  const roleName = DEFAULT_ROLES.find((r) => r.code === user.role)?.name || user.role

  useEffect(() => {
    getMe().then((res) => setProfile(res.user || user)).catch(() => setProfile(user))
    getNotifications().then((res) => setUnread(res.unread || 0)).catch(() => setUnread(0))
  }, [])

  const handleLogout = () => {
    logout()
    navigate(h5Path('login'), { replace: true })
  }

  const menuItems = [
    hasMenu('/schedules') && { label: '日程提醒', onClick: () => navigate(h5Path('schedules')) },
    hasMenu('/schedules') && { label: '检查今日待办', onClick: () => { resetScheduleReminder(); checkTodayScheduleReminder(navigate) } },
    { label: `消息通知${unread > 0 ? ` (${unread})` : ''}`, onClick: () => navigate(h5Path('notifications')) },
    { label: '跟进记录', onClick: () => navigate(h5Path('follow-ups')) },
    canViewFinance() && { label: '回款账单', onClick: () => navigate(h5Path('finance')) },
    canViewContract() && { label: '合同查看', onClick: () => navigate(h5Path('contracts')) },
    canTrace() && { label: '全链路追溯', onClick: () => navigate(h5Path('trace')) },
  ].filter(Boolean)

  return (
    <div>
      <Card className="mobile-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar size={64} src={profile.avatar || undefined} icon={!profile.avatar ? <UserOutlined /> : undefined}
            style={!profile.avatar ? { background: '#6366f1' } : undefined} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{profile.name}</div>
            <div style={{ color: '#999', fontSize: 13, marginTop: 4 }}>@{profile.username}</div>
            <Tag color={ROLE_COLORS[user.role] || 'default'} style={{ marginTop: 8 }}>{roleName}</Tag>
          </div>
        </div>
      </Card>

      <Card className="mobile-card" size="small">
        <div className="mobile-menu-item">
          <span>登录账号</span>
          <span className="mobile-menu-item__sub">{profile.username}</span>
        </div>
        <div className="mobile-menu-item">
          <span>数据权限</span>
          <span className="mobile-menu-item__sub">{permissions.dataScope || '-'}</span>
        </div>
        {menuItems.map((item) => (
          <button key={item.label} type="button" className="mobile-menu-item mobile-menu-item--link" onClick={item.onClick}>
            <span>{item.label}</span>
            <RightOutlined style={{ color: '#ccc', fontSize: 12 }} />
          </button>
        ))}
      </Card>

      <Card className="mobile-card" size="small">
        <p style={{ color: '#666', fontSize: 13, margin: 0 }}>{APP_NAME_SHORT} 移动版</p>
      </Card>

      <Divider />
      <Button block danger icon={<LogoutOutlined />} onClick={handleLogout}>退出登录</Button>
    </div>
  )
}
