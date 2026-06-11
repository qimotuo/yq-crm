import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { searchInstallations, type WorkOrder } from '@/api/workOrder'
import { formatInstallRecord } from '@/utils/installFormat'
import { isLoggedIn, hasOperation, getUser } from '@/utils/auth'
import './index.scss'

export default function OrdersPage() {
  const [customerName, setCustomerName] = useState('')
  const [mac, setMac] = useState('')
  const [imei, setImei] = useState('')
  const [iccid, setIccid] = useState('')
  const [installDate, setInstallDate] = useState('')
  const [list, setList] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const filledCount = [customerName, installDate, mac, imei, iccid].filter(Boolean).length

  useDidShow(() => {
    if (!isLoggedIn()) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })

  const handleSearch = async () => {
    if (!customerName && !mac && !imei && !iccid && !installDate) {
      Taro.showToast({ title: '请至少输入一项查询条件', icon: 'none' })
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const res = await searchInstallations({
        customerName,
        installDate,
        mac,
        imei,
        iccid,
      })
      setList(res.list || [])
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCustomerName('')
    setMac('')
    setImei('')
    setIccid('')
    setInstallDate('')
    setList([])
    setSearched(false)
  }

  const isMine = (order: WorkOrder) => {
    const user = getUser()
    return user?.role === 'admin' || order.installer === user?.name
  }

  const copyRecord = (order: WorkOrder, e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.()
    Taro.setClipboardData({ data: formatInstallRecord(order) })
  }

  const goCreate = () => {
    if (!hasOperation('workorder:install')) {
      Taro.showToast({ title: '无安装登记权限', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: '/pages/orders/detail?mode=create' })
  }

  const goEdit = (id: number) => {
    Taro.navigateTo({ url: `/pages/orders/detail?id=${id}` })
  }

  return (
    <View className='install-page'>
      {hasOperation('workorder:install') && (
        <Button className='btn-add' onClick={goCreate}>+ 新增安装登记</Button>
      )}

      <View className='search-card'>
        <View className='search-header' onClick={() => setExpanded(!expanded)}>
          <View className='search-header-left'>
            <Text className='search-title'>查询条件</Text>
            {!expanded && filledCount > 0 && (
              <Text className='search-summary'>已填 {filledCount} 项</Text>
            )}
          </View>
          <Text className={`search-arrow ${expanded ? 'open' : ''}`}>▶</Text>
        </View>

        {expanded && (
          <View className='search-body'>
            <View className='field'>
              <Text className='field-label'>客户 / 门店名称</Text>
              <Input className='field-input' placeholder='如 B3咖啡' value={customerName}
                onInput={(e) => setCustomerName(e.detail.value)} />
            </View>
            <View className='field'>
              <Text className='field-label'>安装日期</Text>
              <Input className='field-input' placeholder='如 2025-11-22' value={installDate}
                onInput={(e) => setInstallDate(e.detail.value)} />
            </View>
            <View className='field'>
              <Text className='field-label'>MAC</Text>
              <Input className='field-input' placeholder='如 4HB7S24C26000931' value={mac}
                onInput={(e) => setMac(e.detail.value)} />
            </View>
            <View className='field'>
              <Text className='field-label'>IMEI</Text>
              <Input className='field-input' placeholder='设备 IMEI' value={imei}
                onInput={(e) => setImei(e.detail.value)} />
            </View>
            <View className='field'>
              <Text className='field-label'>主卡 / 备用卡号</Text>
              <Input className='field-input' placeholder='ICCID 主卡或备用卡' value={iccid}
                onInput={(e) => setIccid(e.detail.value)} />
            </View>
            <View className='search-actions'>
              <Button className='btn-search' loading={loading} onClick={handleSearch}>查询</Button>
              <Button className='btn-reset' onClick={handleReset}>清空</Button>
            </View>
          </View>
        )}
      </View>

      {loading && <View className='empty'>查询中...</View>}
      {!loading && searched && list.length === 0 && <View className='empty'>未找到登记记录</View>}

      {list.map((order) => (
        <View key={order.id} className='result-card'>
          <View onClick={() => isMine(order) ? goEdit(order.id) : undefined}>
            <Text className='result-text'>{formatInstallRecord(order)}</Text>
            <Text className='result-meta'>
              {order.orderNo} · {order.status} · {order.installer || '-'}
              {isMine(order) ? ' · 点击编辑' : ''}
            </Text>
          </View>
          <View className='result-actions'>
            {isMine(order) && (
              <Text className='action-link' onClick={() => goEdit(order.id)}>编辑</Text>
            )}
            <Text className='action-link' onClick={() => copyRecord(order)}>复制</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
