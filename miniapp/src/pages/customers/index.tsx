import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getCustomers, type Customer } from '@/api/customer'
import { isLoggedIn, hasOperation, isInstaller } from '@/utils/auth'
import './index.scss'

const STATUS_CLASS: Record<string, string> = {
  正常: 'status-done',
  待跟进: 'status-installing',
  中断合作: 'status-fail',
}

export default function CustomersPage() {
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)

  const load = async (kw = keyword) => {
    setLoading(true)
    try {
      const res = await getCustomers(kw)
      setList(res.list || [])
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
    if (isInstaller() || !hasOperation('customer:view')) {
      Taro.showToast({ title: '当前角色无客户权限', icon: 'none' })
      setTimeout(() => Taro.switchTab({ url: '/pages/orders/index' }), 600)
      return
    }
    load()
  })

  const goDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/customers/detail?id=${id}` })
  }

  return (
    <View className='customers-page'>
      <View className='search-bar'>
        <Input
          className='search-input'
          placeholder='搜索客户名/店名/手机号'
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={() => load(keyword)}
        />
        <Text className='search-btn' onClick={() => load(keyword)}>搜索</Text>
      </View>

      {loading && <View className='empty'>加载中...</View>}
      {!loading && list.length === 0 && <View className='empty'>暂无客户</View>}

      {list.map((c) => (
        <View key={c.id} className='card' onClick={() => goDetail(c.id)}>
          <View className='card-head'>
            <Text className='card-title'>{c.customerName}</Text>
            {c.contactStatus && (
              <Text className={`status-tag ${STATUS_CLASS[c.contactStatus] || ''}`}>{c.contactStatus}</Text>
            )}
          </View>
          {c.storeName && <View className='card-row'><Text className='label'>店名</Text><Text>{c.storeName}</Text></View>}
          <View className='card-row'><Text className='label'>联系人</Text><Text>{c.contact || '-'}</Text></View>
          <View className='card-row'>
            <Text className='label'>电话</Text>
            <Text>{c.phone || '-'}</Text>
          </View>
          {c.lastFollowTime && (
            <View className='card-row'><Text className='label'>最近跟进</Text><Text>{c.lastFollowTime}</Text></View>
          )}
        </View>
      ))}
    </View>
  )
}
