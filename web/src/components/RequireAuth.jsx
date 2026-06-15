import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectPermissions } from '../store/authSlice'

function checkPermission(permissions, code) {
  if (!code) return true
  if (permissions.operations?.includes('*')) return true
  return permissions.operations?.includes(code) ?? false
}

function checkMenu(permissions, path) {
  if (permissions.menuKeys?.includes('*')) return true
  return permissions.menuKeys?.includes(path) ?? false
}

export function RequireMenu({ path, children }) {
  const navigate = useNavigate()
  const permissions = useSelector(selectPermissions)

  if (checkMenu(permissions, path)) return children

  return (
    <Result status="403" title="403" subTitle="您没有权限访问此页面"
      extra={<Button type="primary" onClick={() => navigate('/dashboard')}>返回工作台</Button>} />
  )
}

export function Permission({ code, children, fallback = null }) {
  const permissions = useSelector(selectPermissions)
  if (checkPermission(permissions, code)) return children
  return fallback
}
