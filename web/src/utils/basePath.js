/** 根据 URL 判断 React Router basename */
export function getAppBasename() {
  if (typeof window === 'undefined') return ''
  const p = window.location.pathname
  if (p.startsWith('/h5')) return '/h5'
  if (p.startsWith('/crm')) return '/crm'
  return ''
}

/** H5 路由路径（兼容本地 /h5 与线上 basename=/h5） */
export function h5Path(sub = '') {
  const bn = getAppBasename()
  const suffix = sub ? (sub.startsWith('/') ? sub : `/${sub}`) : ''
  if (bn === '/h5') return suffix || '/'
  return `/h5${suffix}`
}

export function isH5Path(pathname) {
  return pathname.startsWith('/h5')
}
