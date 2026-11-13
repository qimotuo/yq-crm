import { BASE_URL } from './request'

/** 上传本地附件，category: install | voucher | idcard | common */
export async function uploadFile(file, category = 'common') {
  const form = new FormData()
  form.append('file', file)
  form.append('category', category)
  const res = await fetch(`${BASE_URL}/uploads`, {
    method: 'POST',
    headers: {
      ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
    },
    body: form,
  })
  const json = await res.json()
  if (json.code !== 200) throw new Error(json.message || '上传失败')
  return json.data
}

/** 将接口返回的 /api/files/... 转为可访问地址（兼容绝对 API 前缀） */
export function fileUrl(url) {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  if (url.startsWith('/api/')) {
    if (!BASE_URL || BASE_URL === '/api') return url
    return `${BASE_URL.replace(/\/api\/?$/, '')}${url}`
  }
  if (url.startsWith('/')) return url
  return `${BASE_URL}/files/${url.replace(/^files\//, '')}`
}
