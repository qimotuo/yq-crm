import { request } from './request'

export function getRoles(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v) })
  const q = qs.toString()
  return request(`/system/roles${q ? `?${q}` : ''}`)
}

export function getRoleDetail(idOrCode) {
  const isNum = !isNaN(Number(idOrCode))
  return request(`/system/roles/detail?${isNum ? 'id' : 'code'}=${idOrCode}`)
}

export function updateRole(data) {
  return request('/system/roles', { method: 'PUT', body: JSON.stringify(data) })
}

export function createRole(data) {
  return request('/system/roles', { method: 'POST', body: JSON.stringify(data) })
}

export function getPermissionsByRole(roleCode) {
  return request(`/system/permissions?role=${roleCode}`)
}

export function getDepartments() {
  return request('/system/departments')
}
