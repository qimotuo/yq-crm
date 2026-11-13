import { useState } from 'react'
import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { createStockOut } from '@/api/stock'
import { getUser, hasOperation, isLoggedIn } from '@/utils/auth'
import './out.scss'

const OPERATORS = ['中国移动', '中国电信', '中国联通']

export default function StockOutPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [operatorIdx, setOperatorIdx] = useState(0)
  const [form, setForm] = useState({
    orderNo: '',
    model: '',
    mac: '',
    imei: '',
    iccid: '',
    iccid2: '',
    operator: '',
    storeName: '',
    customerName: '',
    address: '',
    remark: '',
    mobileNo: '',
    telecomNo: '',
    replacedCardNo: '',
  })

  useDidShow(() => {
    if (!isLoggedIn()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    if (!hasOperation('stock:out')) {
      Taro.showToast({ title: '无出库权限', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 600)
      return
    }
    const p = router.params
    setForm({
      orderNo: p.orderNo ? decodeURIComponent(p.orderNo) : '',
      model: p.model ? decodeURIComponent(p.model) : '',
      mac: p.mac ? decodeURIComponent(p.mac) : '',
      imei: p.imei ? decodeURIComponent(p.imei) : '',
      iccid: p.iccid ? decodeURIComponent(p.iccid) : '',
      iccid2: p.iccid2 ? decodeURIComponent(p.iccid2) : '',
      operator: p.operator ? decodeURIComponent(p.operator) : '',
      storeName: p.storeName ? decodeURIComponent(p.storeName) : '',
      customerName: p.customerName ? decodeURIComponent(p.customerName) : '',
      address: p.address ? decodeURIComponent(p.address) : '',
      mobileNo: p.mobileNo ? decodeURIComponent(p.mobileNo) : '',
      telecomNo: p.telecomNo ? decodeURIComponent(p.telecomNo) : '',
      replacedCardNo: p.replacedCardNo ? decodeURIComponent(p.replacedCardNo) : '',
      remark: '',
    })
    if (p.operator) {
      const idx = OPERATORS.indexOf(decodeURIComponent(p.operator))
      if (idx >= 0) setOperatorIdx(idx)
    }
  })

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!form.orderNo || !form.model || !form.mac) {
      Taro.showToast({ title: '工单号、型号、MAC 必填', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const user = getUser()
      await createStockOut({
        ...form,
        operator: form.operator || OPERATORS[operatorIdx] || '',
        receiver: user?.name || '',
      })
      Taro.showToast({ title: '出库成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='stock-out-page'>
      <Text className='hint'>安装登记后可在此办理设备出库</Text>
      <View className='card'>
        <Text className='section-title'>出库信息</Text>
        <View className='form-item'>
          <Text className='form-label'>工单号 *</Text>
          <Input className='form-input' value={form.orderNo} onInput={(e) => setField('orderNo', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>设备型号 *</Text>
          <Input className='form-input' value={form.model} onInput={(e) => setField('model', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>MAC *</Text>
          <Input className='form-input' value={form.mac} onInput={(e) => setField('mac', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>IMEI</Text>
          <Input className='form-input' value={form.imei} onInput={(e) => setField('imei', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>店名</Text>
          <Input className='form-input' value={form.storeName} onInput={(e) => setField('storeName', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>移动卡号</Text>
          <Input className='form-input' value={form.mobileNo} onInput={(e) => setField('mobileNo', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>电信卡号</Text>
          <Input className='form-input' value={form.telecomNo} onInput={(e) => setField('telecomNo', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>已更换旧卡号</Text>
          <Input className='form-input' value={form.replacedCardNo} onInput={(e) => setField('replacedCardNo', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>主卡 ICCID</Text>
          <Input className='form-input' value={form.iccid} onInput={(e) => setField('iccid', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>备用卡 ICCID</Text>
          <Input className='form-input' value={form.iccid2} onInput={(e) => setField('iccid2', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>运营商</Text>
          <Picker
            mode='selector'
            range={OPERATORS}
            value={operatorIdx}
            onChange={(e) => {
              const idx = Number(e.detail.value)
              setOperatorIdx(idx)
              setField('operator', OPERATORS[idx])
            }}
          >
            <View className='form-input picker-value'>{form.operator || OPERATORS[operatorIdx] || '请选择'}</View>
          </Picker>
        </View>
        <View className='form-item'>
          <Text className='form-label'>备注</Text>
          <Input className='form-input' value={form.remark} onInput={(e) => setField('remark', e.detail.value)} />
        </View>
        <Button className='btn-primary' loading={loading} onClick={handleSubmit}>确认出库</Button>
      </View>
    </View>
  )
}
