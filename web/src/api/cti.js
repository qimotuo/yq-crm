import { BASE_URL, request } from './request'

export function getCtiConfig() {
  return request('/cti/config')
}

export function updateCtiConfig(data) {
  return request('/cti/config', { method: 'PUT', body: JSON.stringify(data) })
}

export function startCall(data) {
  return request('/calls/start', { method: 'POST', body: JSON.stringify(data) })
}

export function endCall(data) {
  return request('/calls/end', { method: 'POST', body: JSON.stringify(data) })
}

export function getCallLogs(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v)
  })
  const q = qs.toString()
  return request(`/calls${q ? `?${q}` : ''}`)
}

export function getServiceOrderPrintTemplate() {
  return request('/print-templates/service-order')
}

export function updateServiceOrderPrintTemplate(data) {
  return request('/print-templates/service-order', { method: 'PUT', body: JSON.stringify(data) })
}

export { BASE_URL }
