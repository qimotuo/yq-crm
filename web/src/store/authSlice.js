import { createSlice } from '@reduxjs/toolkit'

function loadPersistedAuth() {
  try {
    const token = localStorage.getItem('token')
    if (!token) return { token: null, user: null, permissions: {} }
    return {
      token,
      user: JSON.parse(localStorage.getItem('user') || 'null'),
      permissions: JSON.parse(localStorage.getItem('permissions') || '{}'),
    }
  } catch {
    return { token: null, user: null, permissions: {} }
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadPersistedAuth(),
  reducers: {
    setCredentials(state, action) {
      const { token, user, permissions } = action.payload
      state.token = token
      state.user = user
      state.permissions = permissions || {}
    },
    updateUser(state, action) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
      }
    },
    logout(state) {
      state.token = null
      state.user = null
      state.permissions = {}
    },
    updatePermissions(state, action) {
      state.permissions = action.payload
    },
  },
})

export const { setCredentials, logout, updatePermissions, updateUser } = authSlice.actions

const EMPTY_USER = {}
const EMPTY_PERMISSIONS = {}

export const selectToken = (s) => s.auth.token
export const selectUser = (s) => s.auth.user ?? EMPTY_USER
export const selectPermissions = (s) => s.auth.permissions ?? EMPTY_PERMISSIONS
export const selectIsAuthenticated = (s) => !!s.auth.token

export default authSlice.reducer
