import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Card, Form, Input, Button, message, Select } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { login } from '../api'
import { setCredentials } from '../store/authSlice'
import { APP_NAME } from '../constants/app'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const data = await login(values.username, values.password)
      dispatch(setCredentials({ token: data.token, user: data.user, permissions: data.permissions || {} }))
      message.success(`欢迎，${data.user.name}`)
      navigate('/dashboard')
    } catch (e) {
      message.error(e.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (username) => {
    onFinish({ username, password: '123456' })
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-logo">
          <h1>{APP_NAME}</h1>
          <p>客户管理 · 接单派单 · 财务核销</p>
        </div>
        <Form onFinish={onFinish} size="large" initialValues={{ username: 'zhangsan', password: '123456' }}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <p style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>快捷登录（密码均为 123456）：</p>
          <Select style={{ width: '100%' }} placeholder="选择角色快速登录" onChange={quickLogin}
            options={[
              { value: 'admin', label: '① 管理员 admin — 派工/权限/全部' },
              { value: 'zhangsan', label: '② 销售 zhangsan — 公海/接单/客户' },
              { value: 'zhaoyun', label: '③ 安装 zhaoyun — 安装登记' },
              { value: 'finance', label: '④ 财务 finance — 回款/报表' },
            ]} />
        </div>
      </Card>
    </div>
  )
}
