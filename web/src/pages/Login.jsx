import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Card, Form, Input, Button, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { login } from '../api'
import { setCredentials } from '../store/authSlice'
import { APP_NAME, APP_NAME_SHORT } from '../constants/app'
import { getMobileHomePath } from '../utils/mobile'
import { h5Path, isH5Path } from '../utils/basePath'

export default function Login({ mobile = false }) {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const isMobileLogin = mobile || isH5Path(location.pathname)

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const data = await login(values.username, values.password)
      dispatch(setCredentials({ token: data.token, user: data.user, permissions: data.permissions || {} }))
      message.success(`欢迎，${data.user.name}`)
      if (isMobileLogin) {
        const from = location.state?.from
        navigate(from && isH5Path(from) ? from : getMobileHomePath(data.permissions || {}, data.user))
      } else {
        navigate('/dashboard')
      }
    } catch (e) {
      message.error(e.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={isMobileLogin ? 'mobile-login-page' : 'login-page'}>
      <Card className="login-card">
        <div className="login-logo">
          <h1>{isMobileLogin ? APP_NAME_SHORT : APP_NAME}</h1>
          <p>{isMobileLogin ? '移动版 · 工单 · 客户 · 跟进' : '客户管理 · 接单派单 · 财务核销'}</p>
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
        <div className="mobile-login-link">
          {isMobileLogin ? (
            <Link to="/login">使用电脑版登录</Link>
          ) : (
            <Link to={h5Path('login')}>移动端入口 →</Link>
          )}
        </div>
      </Card>
    </div>
  )
}
