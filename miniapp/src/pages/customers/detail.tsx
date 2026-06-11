import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { getCustomerDetail, type Customer } from '@/api/customer'
import { hasOperation } from '@/utils/auth'
import './detail.scss'

export default function CustomerDetailPage() {
  const router = useRouter()
  const id = Number(router.params.id)
  const [customer, setCustomer] = useState<Customer | null>(null)

  useDidShow(async () => {
    try {
      setCustomer(await getCustomerDetail(id))
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  })

  const callPhone = () => {
    if (!customer?.phone) {
      Taro.showToast({ title: '暂无电话', icon: 'none' })
      return
    }
    Taro.makePhoneCall({ phoneNumber: customer.phone })
  }

  const goFollowUps = () => {
    if (!customer) return
    Taro.navigateTo({
      url: `/pages/follow-ups/index?customerId=${customer.id}&customerName=${encodeURIComponent(customer.customerName)}`,
    })
  }

  if (!customer) {
    return <View className='container'><Text className='empty'>加载中...</Text></View>
  }

  return (
    <View className='detail-page container'>
      <View className='card'>
        <Text className='card-title'>{customer.customerName}</Text>
        {customer.storeName && <View className='card-row'><Text className='label'>店名</Text><Text>{customer.storeName}</Text></View>}
        <View className='card-row'><Text className='label'>联系人</Text><Text>{customer.contact || '-'}</Text></View>
        <View className='card-row'><Text className='label'>电话</Text><Text className='phone'>{customer.phone || '-'}</Text></View>
        <View className='card-row'><Text className='label'>销售</Text><Text>{customer.salesName || '-'}</Text></View>
        <View className='card-row'><Text className='label'>状态</Text><Text>{customer.contactStatus || '-'}</Text></View>
        {customer.wechatId && <View className='card-row'><Text className='label'>微信</Text><Text>{customer.wechatId}</Text></View>}
        {customer.address && <View className='card-row'><Text className='label'>地址</Text><Text>{customer.address}</Text></View>}
        {customer.lastFollowTime && (
          <View className='card-row'><Text className='label'>最近跟进</Text><Text>{customer.lastFollowTime}</Text></View>
        )}
      </View>

      <View className='action-bar'>
        {hasOperation('customer:call') && (
          <Button className='btn-primary' onClick={callPhone}>一键外呼</Button>
        )}
        {hasOperation('customer:follow') && (
          <Button className='btn-ghost' onClick={goFollowUps}>跟进记录</Button>
        )}
      </View>
    </View>
  )
}
