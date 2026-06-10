const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const BASE_URL = import.meta.env.VITE_API_BASE || '/api'

const mockHandlers = {}

export function registerMock(method, url, handler) {
  mockHandlers[`${method} ${url}`] = handler
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
  const method = options.method || 'GET'
  const path = getPath(url)
  const queryParams = parseQuery(url)

  if (USE_MOCK) {
    const handler = mockHandlers[`${method} ${path}`]
    if (handler) {
      const body = options.body ? JSON.parse(options.body) : {}
      return handler(body, queryParams)
    }
    throw new Error(`Mock not found: ${method} ${path}`)
  }

  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
      ...options.headers,
    },
    ...options,
  })
  const json = await res.json()
  if (json.code !== 200) throw new Error(json.message || '请求失败')
  return json.data
}

export { USE_MOCK, BASE_URL }
