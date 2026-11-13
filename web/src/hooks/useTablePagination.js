import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../constants/pagination'

function toPageSize(size, fallback) {
  const n = Number(size)
  return PAGE_SIZE_OPTIONS.includes(n) ? n : fallback
}

export function useTablePagination(defaultPageSize = DEFAULT_PAGE_SIZE, itemCount) {
  const [current, setCurrent] = useState(1)
  const [pageSize, setPageSize] = useState(() => toPageSize(defaultPageSize, DEFAULT_PAGE_SIZE))

  useEffect(() => {
    if (typeof itemCount !== 'number' || itemCount < 0) return
    const max = Math.max(1, Math.ceil(itemCount / pageSize) || 1)
    if (current > max) setCurrent(max)
  }, [itemCount, pageSize, current])

  const change = useCallback((page, size) => {
    const nextSize = toPageSize(size, pageSize)
    const nextPage = nextSize !== pageSize ? 1 : (page || 1)
    setPageSize(nextSize)
    setCurrent(nextPage)
    return { page: nextPage, pageSize: nextSize }
  }, [pageSize])

  const pagination = {
    current,
    pageSize,
    showSizeChanger: true,
    pageSizeOptions: PAGE_SIZE_OPTIONS.map(String),
    onChange: (page, size) => change(page, size),
  }

  return { current, pageSize, setCurrent, pagination, change }
}
