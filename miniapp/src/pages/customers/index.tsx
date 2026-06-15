import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getCustomers, createCustomer, type Customer } from '@/api/customer'
import { getPublicPool, claimPublicPool, type PublicPoolCustomer } from '@/api/publicPool'
import { isLoggedIn, hasOperation, isInstaller } from '@/utils/auth'
import './index.scss'

type TabKey = 'mine' | 'pool'

const STATUS_CLASS: Record<string, string> = {
  正常: 'status-done',
  待跟进: 'status-installing',
  中断合作: 'status-fail',
}

export default function CustomersPage() {
  const [tab, setTab] = useState<TabKey>('mine')
  const [keyword, setKeyword] = useState('')
  const [mac, setMac] = useState('')
  const [imei, setImei] = useState('')
  const [iccid, setIccid] = useState('')
  const [poolKeyword, setPoolKeyword] = useState('')
  const [list, setList] = useState<Customer[]>([])
  const [poolList, setPoolList] = useState<PublicPoolCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [poolLoading, setPoolLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    storeName: '',
    customerName: '',
    contact: '',
    phone: '',
    address: '',
  })

  const filledCount = [keyword, mac, imei, iccid].filter(Boolean).length

  const load = async (params?: { keyword?: string; mac?: string; imei?: string; iccid?: string }) => {
    const search = {
      keyword: params?.keyword ?? keyword,
      mac: params?.mac ?? mac,
      imei: params?.imei ?? imei,
      iccid: params?.iccid ?? iccid,
    }
    const hasFilter = Object.values(search).some(Boolean)
    setLoading(true)
    setSearched(hasFilter)
    try {
      const res = await getCustomers(hasFilter ? search : {})
      setList(res.list || [])
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const loadPool = async (kw = poolKeyword) => {
    setPoolLoading(true)
    try {
      const res = await getPublicPool(kw)
      setPoolList(res.list || [])
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setPoolLoading(false)
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
    if (tab === 'mine' && !searched) load({ keyword: '', mac: '', imei: '', iccid: '' })
    if (tab === 'pool') loadPool()
  })

  const handleSearch = () => {
    if (!keyword && !mac && !imei && !iccid) {
      Taro.showToast({ title: '请至少输入一项查询条件', icon: 'none' })
      return
    }
    load()
  }

  const handleReset = () => {
    setKeyword('')
    setMac('')
    setImei('')
    setIccid('')
    setSearched(false)
    load({ keyword: '', mac: '', imei: '', iccid: '' })
  }

  const handleClaim = async (id: number, e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.()
    if (!hasOperation('customer:claim')) {
      Taro.showToast({ title: '无领取权限', icon: 'none' })
      return
    }
    try {
      await claimPublicPool(id)
      Taro.showToast({ title: '领取成功', icon: 'success' })
      loadPool()
    } catch (err) {
      Taro.showToast({ title: (err as Error).message, icon: 'none' })
    }
  }

  const handleCreate = async () => {
    if (!createForm.storeName.trim() || !createForm.customerName.trim()) {
      Taro.showToast({ title: '请填写店名和客户名称', icon: 'none' })
      return
    }
    try {
      await createCustomer(createForm)
      Taro.showToast({ title: '客户已创建', icon: 'success' })
      setShowCreate(false)
      setCreateForm({ storeName: '', customerName: '', contact: '', phone: '', address: '' })
      setTab('mine')
      load({ keyword: '', mac: '', imei: '', iccid: '' })
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  }

  const goDetail = (c: Customer) => {
    if (c.workOrderId) {
      Taro.navigateTo({ url: `/pages/customers/detail?workOrderId=${c.workOrderId}` })
      return
    }
    Taro.navigateTo({ url: `/pages/customers/detail?id=${c.id}` })
  }

  const showDeviceInfo = searched && filledCount > 0

  return (
    <View className='customers-page'>
      <View className='tab-bar'>
        <Text className={`tab-item ${tab === 'mine' ? 'active' : ''}`} onClick={() => { setTab('mine'); load({ keyword: '', mac: '', imei: '', iccid: '' }) }}>
          我的客户
        </Text>
        {hasOperation('customer:claim') && (
          <Text className={`tab-item ${tab === 'pool' ? 'active' : ''}`} onClick={() => { setTab('pool'); loadPool() }}>
            公海池
          </Text>
        )}
      </View>

      {tab === 'mine' && (
        <View>
          {hasOperation('customer:create') && (
            <Button className='btn-add' onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? '取消新建' : '+ 新建客户'}
            </Button>
          )}

          {showCreate && (
            <View className='search-card'>
              <View className='field'>
                <Text className='field-label'>店名 *</Text>
                <Input className='field-input' value={createForm.storeName}
                  onInput={(e) => setCreateForm({ ...createForm, storeName: e.detail.value })} />
              </View>
              <View className='field'>
                <Text className='field-label'>客户名称 *</Text>
                <Input className='field-input' value={createForm.customerName}
                  onInput={(e) => setCreateForm({ ...createForm, customerName: e.detail.value })} />
              </View>
              <View className='field'>
                <Text className='field-label'>联系人</Text>
                <Input className='field-input' value={createForm.contact}
                  onInput={(e) => setCreateForm({ ...createForm, contact: e.detail.value })} />
              </View>
              <View className='field'>
                <Text className='field-label'>电话</Text>
                <Input className='field-input' value={createForm.phone} type='number'
                  onInput={(e) => setCreateForm({ ...createForm, phone: e.detail.value })} />
              </View>
              <View className='field'>
                <Text className='field-label'>地址</Text>
                <Input className='field-input' value={createForm.address}
                  onInput={(e) => setCreateForm({ ...createForm, address: e.detail.value })} />
              </View>
              <Button className='btn-search' onClick={handleCreate}>保存</Button>
            </View>
          )}

          <View className='search-card'>
            <View className='search-header' onClick={() => setExpanded(!expanded)}>
              <View className='search-header-left'>
                <Text className='search-title'>客户查询</Text>
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
                  <Input className='field-input' placeholder='如 B3咖啡' value={keyword}
                    onInput={(e) => setKeyword(e.detail.value)} />
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
          {!loading && searched && list.length === 0 && <View className='empty'>未找到客户</View>}
          {!loading && !searched && list.length === 0 && <View className='empty'>暂无客户</View>}

          {list.map((c) => (
            <View key={c.workOrderId ? `wo-${c.workOrderId}` : c.id} className='card' onClick={() => goDetail(c)}>
              <View className='card-head'>
                <Text className='card-title'>{c.customerName}</Text>
                {c.contactStatus ? (
                  <Text className={`status-tag ${STATUS_CLASS[c.contactStatus] || ''}`}>{c.contactStatus}</Text>
                ) : c.workOrderId ? (
                  <Text className='status-tag status-installing'>安装登记</Text>
                ) : null}
              </View>
              {c.storeName && <View className='card-row'><Text className='label'>店名</Text><Text>{c.storeName}</Text></View>}
              <View className='card-row'><Text className='label'>联系人</Text><Text>{c.contact || '-'}</Text></View>
              <View className='card-row'>
                <Text className='label'>电话</Text>
                <Text>{c.phone || '-'}</Text>
              </View>
              {showDeviceInfo && c.mac && (
                <View className='card-row'><Text className='label'>MAC</Text><Text>{c.mac}</Text></View>
              )}
              {showDeviceInfo && c.imei && (
                <View className='card-row'><Text className='label'>IMEI</Text><Text>{c.imei}</Text></View>
              )}
              {showDeviceInfo && c.iccid && (
                <View className='card-row'><Text className='label'>主卡</Text><Text>{c.iccid}</Text></View>
              )}
              {showDeviceInfo && c.backupIccid && (
                <View className='card-row'><Text className='label'>备用卡</Text><Text>{c.backupIccid}</Text></View>
              )}
              {c.installDate && (
                <View className='card-row'><Text className='label'>安装日期</Text><Text>{c.installDate}</Text></View>
              )}
              {c.lastFollowTime && (
                <View className='card-row'><Text className='label'>最近跟进</Text><Text>{c.lastFollowTime}</Text></View>
              )}
            </View>
          ))}
        </View>
      )}

      {tab === 'pool' && (
        <View>
          <View className='search-card'>
            <View className='search-body'>
              <View className='field'>
                <Text className='field-label'>搜索公海客户</Text>
                <Input className='field-input' placeholder='客户或门店名称' value={poolKeyword}
                  onInput={(e) => setPoolKeyword(e.detail.value)} />
              </View>
              <Button className='btn-search' loading={poolLoading} onClick={() => loadPool()}>查询</Button>
            </View>
          </View>

          {poolLoading && <View className='empty'>加载中...</View>}
          {!poolLoading && poolList.length === 0 && <View className='empty'>公海暂无客户</View>}

          {poolList.map((c) => (
            <View key={c.id} className='card'>
              <View className='card-head'>
                <Text className='card-title'>{c.customerName}</Text>
                <Text className='status-tag status-installing'>在公海</Text>
              </View>
              {c.storeName && <View className='card-row'><Text className='label'>店名</Text><Text>{c.storeName}</Text></View>}
              <View className='card-row'><Text className='label'>联系人</Text><Text>{c.contact || '-'}</Text></View>
              <View className='card-row'><Text className='label'>电话</Text><Text>{c.phone || '-'}</Text></View>
              {c.address && <View className='card-row'><Text className='label'>地址</Text><Text>{c.address}</Text></View>}
              {hasOperation('customer:claim') && (
                <Button className='btn-claim' size='mini' onClick={() => handleClaim(c.id)}>领取</Button>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
