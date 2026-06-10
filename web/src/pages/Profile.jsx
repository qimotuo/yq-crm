import { useNavigate } from 'react-router-dom'
import { Card, Descriptions, Avatar, Tag, Button } from 'antd'
import { UserOutlined, LogoutOutlined } from '@ant-design/icons'
import { useAuth } from '../hooks/useAuth'
import { DEFAULT_ROLES, ROLE_COLORS } from '../rbac/config'

export default function Profile() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const roleName = DEFAULT_ROLES.find((r) => r.code === user.role)?.name || user.role

  return (
    <div>
      <div className="page-header">
        <h2>个人信息</h2>
        <p>当前登录账号信息（模拟小程序「我的」页面）</p>
      </div>
      <Card style={{ maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar size={80} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
          <h3 style={{ marginTop: 12, marginBottom: 4 }}>{user.name}</h3>
          <Tag color={ROLE_COLORS[user.role]}>{roleName}</Tag>
        </div>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
          <Descriptions.Item label="姓名">{user.name}</Descriptions.Item>
          <Descriptions.Item label="角色">{roleName}</Descriptions.Item>
          <Descriptions.Item label="账号状态"><Tag color="success">正常</Tag></Descriptions.Item>
        </Descriptions>
        <Button danger icon={<LogoutOutlined />} style={{ marginTop: 24 }} block
          onClick={() => { logout(); navigate('/login') }}>
          退出登录
        </Button>
      </Card>
    </div>
  )
}
