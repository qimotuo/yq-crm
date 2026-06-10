import { useDispatch, useSelector } from 'react-redux'
import { logout, selectIsAuthenticated, selectPermissions, selectUser } from '../store/authSlice'

export function useAuth() {
  const dispatch = useDispatch()
  const user = useSelector(selectUser)
  const permissions = useSelector(selectPermissions)
  const isAuthenticated = useSelector(selectIsAuthenticated)

  return {
    user,
    permissions,
    isAuthenticated,
    logout: () => dispatch(logout()),
  }
}
