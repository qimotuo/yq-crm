import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectPermissions } from '../store/authSlice'
import { hasMenuAccess } from '../rbac/utils'
import { getMobileHomePath } from '../utils/mobile'

export default function MobileGuard({ menuKeys, children }) {
  const navigate = useNavigate()
  const permissions = useSelector(selectPermissions)
  const keys = Array.isArray(menuKeys) ? menuKeys : [menuKeys]
  const allowed = keys.some((key) => hasMenuAccess(permissions, key))

  if (allowed) return children

  return (
    <Result
      status="403"
      title="无权限"
      subTitle="当前账号无法访问此功能"
      extra={<Button type="primary" onClick={() => navigate(getMobileHomePath(permissions))}>返回</Button>}
    />
  )
}
