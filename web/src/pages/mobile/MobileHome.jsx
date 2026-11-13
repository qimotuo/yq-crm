import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectPermissions, selectUser } from '../../store/authSlice'
import { getMobileHomePath } from '../../utils/mobile'

export default function MobileHome() {
  const permissions = useSelector(selectPermissions)
  const user = useSelector(selectUser)
  return <Navigate to={getMobileHomePath(permissions, user)} replace />
}
