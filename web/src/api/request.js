import store from '../store'
import { logout } from '../store/authSlice'
import { getAppBasename } from '../utils/basePath'

const BASE_URL = import.meta.env.VITE_API_BASE || '/api'

let redirectingLogin = false

function loginUrl() {
  const base = getAppBasename()
  if (base === '/h5') return '/h5/login'
  if (base === '/crm') return '/crm/login'
  if (window.location.pathname.startsWith('/h5')) return '/h5/login'
  return '/login'
}

function expireSession(message) {
  store.dispatch(logout())
  const err = new Error(message || '登录已过期，请重新登录')
  err.status = 401
  if (!redirectingLogin && !window.location.pathname.endsWith('/login')) {
    redirectingLogin = true
    window.location.replace(loginUrl())
  }
  return err
}

function parseQuery(url) {
  const idx = url.indexOf('?')
  if (idx === -1) return {}
  const params = {}
  new URLSearchParams(url.slice(idx + 1)).forEach((v, k) => {
    params[k] = v
  })
  return params
}

function getPath(url) {
  const idx = url.indexOf('?')
  return idx === -1 ? url : url.slice(0, idx)
}

export async function request(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
      ...options.headers,
    },
    ...options,
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 401 || json.code === 401) throw expireSession(json.message)
  if (json.code !== 200) throw new Error(json.message || '请求失败')
  return json.data
}

export { BASE_URL }
