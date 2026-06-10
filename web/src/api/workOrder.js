import { request } from './request'

export function getWorkOrders(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/work-orders?${qs}`)
}

export function createWorkOrder(data) {
  return request('/work-orders', { method: 'POST', body: JSON.stringify(data) })
}

export function dispatchWorkOrder(id, installer) {
  return request('/work-orders/dispatch', { method: 'PUT', body: JSON.stringify({ id, installer }) })
}

export function updateWorkOrderStatus(id, status) {
  return request('/work-orders/status', { method: 'PUT', body: JSON.stringify({ id, status }) })
}

export function deleteWorkOrder(id) {
  return request('/work-orders', { method: 'DELETE', body: JSON.stringify({ id }) })
}

export function getInstallers() {
  return request('/installers')
}

export function updateWorkOrder(id, data) {
  return request('/work-orders/update', { method: 'PUT', body: JSON.stringify({ id, ...data }) })
}

export function installRegister(id, data) {
  return request('/work-orders/install', { method: 'PUT', body: JSON.stringify({ id, ...data }) })
}

export function getMyWorkOrders(params) {
  const qs = new URLSearchParams(params).toString()
  return request(`/work-orders/my?${qs}`)
}

export function updateWorkOrderStatusWithReason(id, status, failReason) {
  return request('/work-orders/status', { method: 'PUT', body: JSON.stringify({ id, status, failReason }) })
}
