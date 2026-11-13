import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectPermissions } from '../store/authSlice'
import { hasMenuAccess } from '../rbac/utils'

export function RequireMenu({ path, children }) {
  const navigate = useNavigate()
  const permissions = useSelector(selectPermissions)

  if (hasMenuAccess(permissions, path)) return children

  return (
    <Result status="403" title="403" subTitle="您没有权限访问此页面"
      extra={<Button type="primary" onClick={() => navigate('/dashboard')}>返回工作台</Button>} />
  )
}

export function Permission({ code, children, fallback = null }) {
  const permissions = useSelector(selectPermissions)
  if (!code) return children
  if (permissions.operations?.includes('*')) return children
  if (permissions.operations?.includes(code)) return children
  return fallback
}
