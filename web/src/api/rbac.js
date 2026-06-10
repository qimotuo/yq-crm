import { request } from './request'

export function getRoles() {
  return request('/system/roles')
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
