import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'

const store = configureStore({
  reducer: { auth: authReducer },
})

store.subscribe(() => {
  const { token, user, permissions } = store.getState().auth
  if (token) {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('permissions', JSON.stringify(permissions))
  } else {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('permissions')
  }
})

export default store
