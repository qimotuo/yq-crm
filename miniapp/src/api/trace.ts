import { request } from '@/utils/request'

export interface TraceResult {
  key: string
  steps: string[]
}

export type TraceType = 'orderNo' | 'mac' | 'iccid' | 'customer' | 'contractNo'

export function traceQuery(type: TraceType, value: string) {
  const qs = `type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`
  return request<TraceResult | null>(`/trace?${qs}`)
}
