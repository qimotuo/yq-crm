import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getMe } from '../api/auth'
import { logout, selectIsAuthenticated, selectPermissions, selectUser, setCredentials, updateUser } from '../store/authSlice'

export function useSessionCheck() {
  const dispatch = useDispatch()
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const [ready, setReady] = useState(!isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) {
      setReady(true)
      return undefined
    }
    let cancelled = false
    setReady(false)
    getMe()
      .then((data) => {
        if (cancelled) return
        const token = localStorage.getItem('token')
        if (!token) {
          dispatch(logout())
          return
        }
        dispatch(setCredentials({
          token,
          user: data.user,
          permissions: data.permissions || {},
        }))
        setReady(true)
      })
      .catch((e) => {
        if (cancelled) return
        if (e?.status === 401) dispatch(logout())
        else setReady(true)
      })
    return () => { cancelled = true }
  }, [dispatch, isAuthenticated])

  return ready
}

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
    updateUser: (data) => dispatch(updateUser(data)),
  }
}
