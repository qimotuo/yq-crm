/** 客户端筛选时短暂展示 loading，避免瞬时操作无反馈 */
export function runClientQuery(setLoading, apply) {
  setLoading(true)
  setTimeout(() => {
    apply()
    setLoading(false)
  }, 180)
}
