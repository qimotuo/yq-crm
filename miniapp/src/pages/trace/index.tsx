import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { traceQuery, type TraceType } from '@/api/trace'
import { canTrace, isLoggedIn } from '@/utils/auth'
import './index.scss'

const TRACE_TYPES: { value: TraceType; label: string; placeholder: string }[] = [
  { value: 'orderNo', label: '工单号', placeholder: 'GD-20261025-088' },
  { value: 'mac', label: 'MAC', placeholder: 'AA:BB:CC:DD:EE:01' },
  { value: 'iccid', label: 'ICCID', placeholder: '89860123456789012345' },
  { value: 'customer', label: '客户', placeholder: '智慧社区A区物业' },
  { value: 'contractNo', label: '合同号', placeholder: 'SH20261105001' },
]

export default function TracePage() {
  const router = useRouter()
  const [type, setType] = useState<TraceType>('orderNo')
  const [value, setValue] = useState('')
  const [result, setResult] = useState<{ key: string; steps: string[] } | null>(null)
  const [loading, setLoading] = useState(false)

  const runSearch = async (traceType: TraceType, kw: string) => {
    if (!kw.trim()) return
    setLoading(true)
    try {
      const res = await traceQuery(traceType, kw.trim())
      setResult(res)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useDidShow(() => {
    if (!isLoggedIn()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    if (!canTrace()) {
      Taro.showToast({ title: '无追溯权限', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 600)
      return
    }
    const initType = (router.params.type as TraceType) || 'orderNo'
    const initValue = router.params.value ? decodeURIComponent(router.params.value) : ''
    if (initType && TRACE_TYPES.some((t) => t.value === initType)) {
      setType(initType)
    }
    if (initValue) {
      setValue(initValue)
      runSearch(initType, initValue)
    }
  })

  const current = TRACE_TYPES.find((t) => t.value === type)

  return (
    <View className='trace-page container'>
      <View className='type-row'>
        {TRACE_TYPES.map((t) => (
          <Text
            key={t.value}
            className={`type-chip ${type === t.value ? 'active' : ''}`}
            onClick={() => setType(t.value)}
          >
            {t.label}
          </Text>
        ))}
      </View>

      <View className='search-row'>
        <Input
          className='search-input'
          value={value}
          placeholder={current?.placeholder}
          onInput={(e) => setValue(e.detail.value)}
        />
        <Button
          className='btn-primary'
          loading={loading}
          onClick={() => runSearch(type, value)}
        >
          查询
        </Button>
      </View>

      <Text className='hint'>演示: 智慧社区 / GD-20261025 / AA:BB:CC / SH20261105001</Text>

      {result ? (
        <View className='result-card'>
          <Text className='result-title'>链路：{result.key}</Text>
          {result.steps.map((step, i) => (
            <View key={i} className='step-item'>
              <View className='step-dot' />
              <Text className='step-text'>{step}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className='empty'>输入关键字开始追溯</Text>
      )}
    </View>
  )
}
