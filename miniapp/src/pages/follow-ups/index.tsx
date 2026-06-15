import { useState } from 'react'
import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { getFollowUps, createFollowUp, type FollowUp } from '@/api/followUp'
import { isLoggedIn, hasOperation } from '@/utils/auth'
import './index.scss'

const TYPES = ['电话', '微信', '上门']

export default function FollowUpsPage() {
  const router = useRouter()
  const customerId = router.params.customerId ? Number(router.params.customerId) : undefined
  const customerName = router.params.customerName ? decodeURIComponent(router.params.customerName) : ''
  const [list, setList] = useState<FollowUp[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: '电话', content: '', nextPlan: '' })

  const load = async () => {
    try {
      const res = await getFollowUps(customerId)
      setList(res.list || [])
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  }

  useDidShow(() => {
    if (!isLoggedIn()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    load()
  })

  const handleSubmit = async () => {
    if (!customerId || !customerName) {
      Taro.showToast({ title: '请从客户详情进入新增', icon: 'none' })
      return
    }
    if (!form.content) {
      Taro.showToast({ title: '请填写跟进内容', icon: 'none' })
      return
    }
    try {
      await createFollowUp({ customerId, customerName, ...form })
      Taro.showToast({ title: '已保存', icon: 'success' })
      setShowForm(false)
      setForm({ type: '电话', content: '', nextPlan: '' })
      load()
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  }

  return (
    <View className='follow-page container'>
      {customerId && customerName && hasOperation('customer:follow') && (
        <Button className='btn-primary add-btn' onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : `新增跟进 · ${customerName}`}
        </Button>
      )}

      {showForm && (
        <View className='card'>
          <View className='form-item'>
            <Text className='form-label'>方式</Text>
            <Picker mode='selector' range={TYPES} onChange={(e) => setForm({ ...form, type: TYPES[Number(e.detail.value)] })}>
              <View className='form-input'>{form.type}</View>
            </Picker>
          </View>
          <View className='form-item'>
            <Text className='form-label'>内容</Text>
            <Input className='form-input' value={form.content} placeholder='跟进内容'
              onInput={(e) => setForm({ ...form, content: e.detail.value })} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>下次计划</Text>
            <Input className='form-input' value={form.nextPlan} placeholder='如 2026-10-28 14:00 回访'
              onInput={(e) => setForm({ ...form, nextPlan: e.detail.value })} />
          </View>
          <Button className='btn-primary' onClick={handleSubmit}>保存</Button>
        </View>
      )}

      {list.length === 0 && <View className='empty'>暂无跟进记录</View>}

      {list.map((item) => (
        <View key={item.id} className='card'>
          <View className='card-head'>
            <Text className='card-title'>{item.customerName}</Text>
            <Text className='type-tag'>{item.type}</Text>
          </View>
          <Text className='content'>{item.content}</Text>
          {item.nextPlan && <View className='card-row'><Text className='label'>下次</Text><Text>{item.nextPlan}</Text></View>}
          <Text className='time'>{item.createTime}</Text>
        </View>
      ))}
    </View>
  )
}
