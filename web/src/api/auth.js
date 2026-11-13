import { request } from './request'

export function login(username, password) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

export function getMe() {
  return request('/auth/me')
}

export function updateProfile(data) {
  return request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) })
}

export function changePassword(oldPassword, newPassword) {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  })
}
