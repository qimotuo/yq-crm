import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  searchInstallations,
  getMyWorkOrders,
  getMySalesOrders,
  getWorkOrders,
  type WorkOrder,
} from '@/api/workOrder'
import { formatInstallRecord } from '@/utils/installFormat'
import { formatDispatchRecord } from '@/utils/dispatchFormat'
import { isLoggedIn, hasOperation, getUser, isSales, isInstaller, canDispatch } from '@/utils/auth'
import './index.scss'

type TabKey = 'dispatch' | 'register' | 'pending'

const DISPATCH_STATUS_CLASS: Record<string, string> = {
  待派工: 'dispatch-pending',
  已派工: 'dispatch-dispatched',
  安装成功: 'dispatch-success',
  已安装: 'dispatch-success',
  失败: 'dispatch-fail',
  推迟安装: 'dispatch-postpone',
}

export default function OrdersPage() {
  const [tab, setTab] = useState<TabKey>(isSales() ? 'dispatch' : 'dispatch')
  const [dispatchList, setDispatchList] = useState<WorkOrder[]>([])
  const [dispatchLoading, setDispatchLoading] = useState(false)
  const [pendingList, setPendingList] = useState<WorkOrder[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)

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

  const loadPending = async () => {
    if (!canDispatch()) return
    setPendingLoading(true)
    try {
      const res = await getWorkOrders({ status: '待派工' })
      setPendingList(res.list || [])
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setPendingLoading(false)
    }
  }

  const loadDispatch = async () => {
    setDispatchLoading(true)
    try {
      if (isSales() && hasOperation('workorder:create')) {
        const res = await getMySalesOrders()
        setDispatchList(res.list || [])
      } else if (isInstaller() || hasOperation('workorder:install')) {
        const user = getUser()
        const res = await getMyWorkOrders({ installer: user?.name })
        setDispatchList(res.list || [])
      }
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setDispatchLoading(false)
    }
  }

  useDidShow(() => {
    if (!isLoggedIn()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    loadDispatch()
    loadPending()
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

  const copyRecord = (text: string, e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.()
    Taro.setClipboardData({ data: text })
  }

  const goCreateDispatch = () => {
    if (!hasOperation('workorder:create')) {
      Taro.showToast({ title: '无发单权限', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: '/pages/orders/dispatch-detail?mode=create' })
  }

  const goDispatchDetail = (id: number) => {
    Taro.navigateTo({ url: `/pages/orders/dispatch-detail?id=${id}` })
  }

  const goCreateRegister = () => {
    if (!hasOperation('workorder:install')) {
      Taro.showToast({ title: '无安装登记权限', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: '/pages/orders/detail?mode=create' })
  }

  const goEditRegister = (id: number) => {
    Taro.navigateTo({ url: `/pages/orders/detail?id=${id}` })
  }

  return (
    <View className='install-page'>
      <View className='tab-bar'>
        <Text className={`tab-item ${tab === 'dispatch' ? 'active' : ''}`} onClick={() => setTab('dispatch')}>
          安装派单
        </Text>
        {canDispatch() && (
          <Text className={`tab-item ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
            待派工
          </Text>
        )}
        <Text className={`tab-item ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
          安装登记
        </Text>
      </View>

      {tab === 'pending' && canDispatch() && (
        <View>
          {pendingLoading && <View className='empty'>加载中...</View>}
          {!pendingLoading && pendingList.length === 0 && (
            <View className='empty'>暂无待派工工单</View>
          )}
          {pendingList.map((order) => (
            <View key={order.id} className='result-card' onClick={() => goDispatchDetail(order.id)}>
              <View className='dispatch-head'>
                <Text className='dispatch-no'>{order.orderNo}</Text>
                <Text className='dispatch-status dispatch-pending'>{order.status}</Text>
              </View>
              <Text className='result-text'>{formatDispatchRecord(order)}</Text>
              <Text className='result-meta'>{order.salesName || '-'} · 点击派工</Text>
            </View>
          ))}
        </View>
      )}

      {tab === 'dispatch' && (
        <View>
          {hasOperation('workorder:create') && (
            <Button className='btn-add' onClick={goCreateDispatch}>+ 发安装单</Button>
          )}

          {dispatchLoading && <View className='empty'>加载中...</View>}
          {!dispatchLoading && dispatchList.length === 0 && (
            <View className='empty'>
              {isSales() ? '暂无派单，点击上方发安装单' : '暂无待处理派单'}
            </View>
          )}

          {dispatchList.map((order) => (
            <View key={order.id} className='result-card' onClick={() => goDispatchDetail(order.id)}>
              <View className='dispatch-head'>
                <Text className='dispatch-no'>{order.orderNo}</Text>
                <Text className={`dispatch-status ${DISPATCH_STATUS_CLASS[order.status] || ''}`}>
                  {order.status}
                </Text>
              </View>
              <Text className='result-text'>{formatDispatchRecord(order)}</Text>
              <Text className='result-meta'>
                {order.salesName || '-'} · {order.installer || '待派工'}
              </Text>
              <View className='result-actions'>
                <Text className='action-link' onClick={(e) => copyRecord(formatDispatchRecord(order), e)}>
                  复制
                </Text>
                {(isInstaller() || isSales()) && (
                  <Text className='action-link'>查看详情</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {tab === 'register' && (
        <View>
          {hasOperation('workorder:install') && (
            <Button className='btn-add' onClick={goCreateRegister}>+ 新增安装登记</Button>
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
              <View onClick={() => isMine(order) ? goEditRegister(order.id) : undefined}>
                <Text className='result-text'>{formatInstallRecord(order)}</Text>
                <Text className='result-meta'>
                  {order.orderNo} · {order.status} · {order.installer || '-'}
                  {isMine(order) ? ' · 点击编辑' : ''}
                </Text>
              </View>
              <View className='result-actions'>
                {isMine(order) && (
                  <Text className='action-link' onClick={() => goEditRegister(order.id)}>编辑</Text>
                )}
                <Text className='action-link' onClick={() => copyRecord(formatInstallRecord(order))}>复制</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
