import { useState } from 'react'
import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import {
  getInstallationDetail,
  createInstallation,
  updateInstallation,
  installRegister,
  INSTALL_STATUSES,
  type WorkOrder,
} from '@/api/workOrder'
import { formatInstallRecord } from '@/utils/installFormat'
import { getUser, hasOperation } from '@/utils/auth'
import './detail.scss'

const emptyForm = () => ({
  installDate: '',
  storeName: '',
  customerName: '',
  deviceModel: '',
  mac: '',
  imei: '',
  iccid: '',
  backupIccid: '',
  status: '已安装',
  installRemark: '',
  failReason: '',
})

export default function OrderDetailPage() {
  const router = useRouter()
  const recordId = router.params.id ? Number(router.params.id) : 0
  const fromOrderId = router.params.orderId ? Number(router.params.orderId) : 0
  const isCreate = router.params.mode === 'create' || !recordId
  const [record, setRecord] = useState<WorkOrder | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [loading, setLoading] = useState(false)
  const [statusIdx, setStatusIdx] = useState(0)

  const loadRecord = async () => {
    if (!recordId) return
    try {
      const item = await getInstallationDetail(recordId)
      setRecord(item)
      setForm({
        installDate: item.installDate || '',
        storeName: item.storeName || '',
        customerName: item.customerName || '',
        deviceModel: item.deviceModel || '',
        mac: item.mac || '',
        imei: item.imei || '',
        iccid: item.iccid || '',
        backupIccid: item.backupIccid || '',
        status: item.status || '已安装',
        installRemark: item.installRemark || '',
        failReason: item.failReason || '',
      })
      const idx = INSTALL_STATUSES.indexOf(item.status)
      setStatusIdx(idx >= 0 ? idx : 0)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  }

  useDidShow(() => {
    if (isCreate) {
      const today = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const date = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
      const prefill = {
        ...emptyForm(),
        installDate: router.params.installDate ? decodeURIComponent(router.params.installDate) : date,
        storeName: router.params.storeName ? decodeURIComponent(router.params.storeName) : '',
        customerName: router.params.customerName ? decodeURIComponent(router.params.customerName) : '',
      }
      setForm(prefill)
      setStatusIdx(0)
    } else {
      loadRecord()
    }
  })

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const canEdit = () => {
    if (isCreate) return true
    const user = getUser()
    if (!record) return false
    return user?.role === 'admin' || record.installer === user?.name
  }

  const editable = canEdit() || (isCreate && !!fromOrderId)

  const promptStockOut = (order: WorkOrder) => {
    if (!hasOperation('stock:out') || !form.mac) {
      setTimeout(() => Taro.navigateBack(), 800)
      return
    }
    const q = [
      `orderNo=${encodeURIComponent(order.orderNo || '')}`,
      `model=${encodeURIComponent(form.deviceModel || order.deviceModel || '设备')}`,
      `mac=${encodeURIComponent(form.mac)}`,
      `imei=${encodeURIComponent(form.imei || '')}`,
      `iccid=${encodeURIComponent(form.iccid || '')}`,
      `iccid2=${encodeURIComponent(form.backupIccid || '')}`,
      `operator=${encodeURIComponent(order.operator || '')}`,
      `storeName=${encodeURIComponent(form.storeName || order.storeName || '')}`,
      `customerName=${encodeURIComponent(form.customerName || order.customerName || '')}`,
      `address=${encodeURIComponent(order.address || '')}`,
    ].join('&')
    Taro.showModal({
      title: '登记完成',
      content: '是否办理设备出库？',
      confirmText: '去出库',
      cancelText: '稍后',
      success: (r) => {
        if (r.confirm) {
          Taro.redirectTo({ url: `/pages/stock/out?${q}` })
        } else {
          Taro.navigateBack()
        }
      },
    })
  }

  const handleSubmit = async () => {
    if (!form.storeName && !form.customerName) {
      Taro.showToast({ title: '请填写门店或客户名称', icon: 'none' })
      return
    }
    if (!canEdit()) {
      Taro.showToast({ title: '只能修改自己的登记', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        status: '已安装',
        customerName: form.customerName || form.storeName,
      }
      let saved: WorkOrder | null = null
      if (isCreate && fromOrderId) {
        saved = await installRegister(fromOrderId, payload)
        Taro.showToast({ title: '登记完成', icon: 'success' })
      } else if (isCreate) {
        saved = await createInstallation(payload)
        Taro.showToast({ title: '登记已创建', icon: 'success' })
      } else {
        saved = await updateInstallation(recordId, payload)
        Taro.showToast({ title: '已保存', icon: 'success' })
      }
      if (saved && (isCreate && fromOrderId)) {
        setTimeout(() => promptStockOut(saved!), 400)
      } else {
        setTimeout(() => Taro.navigateBack(), 800)
      }
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const preview = formatInstallRecord({
    ...(record || {}),
    ...form,
    customerName: form.customerName || form.storeName,
  } as WorkOrder)

  return (
    <View className='detail-page container'>
      {!isCreate && record && (
        <View className='card'>
          <Text className='card-title'>{record.orderNo}</Text>
          <View className='card-row'>
            <Text className='label'>登记人</Text>
            <Text>{record.installer || '-'}</Text>
          </View>
        </View>
      )}

      <View className='card'>
        <Text className='section-title'>{isCreate ? '新增安装登记' : '登记信息'}</Text>

        <View className='form-item'>
          <Text className='form-label'>状态</Text>
          <Picker
            mode='selector'
            range={INSTALL_STATUSES}
            disabled={!editable}
            value={statusIdx}
            onChange={(e) => {
              const idx = Number(e.detail.value)
              setStatusIdx(idx)
              setField('status', INSTALL_STATUSES[idx])
            }}
          >
            <View className='form-input picker-value'>{form.status}</View>
          </Picker>
        </View>

        <View className='form-item'>
          <Text className='form-label'>期（安装日期）</Text>
          <Input className='form-input' disabled={!editable} value={form.installDate}
            placeholder='2025-11-22' onInput={(e) => setField('installDate', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>门店 *</Text>
          <Input className='form-input' disabled={!editable} value={form.storeName}
            placeholder='B3咖啡（新天地）' onInput={(e) => setField('storeName', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>客户名称</Text>
          <Input className='form-input' disabled={!editable} value={form.customerName}
            placeholder='默认同门店' onInput={(e) => setField('customerName', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>设备型号</Text>
          <Input className='form-input' disabled={!editable} value={form.deviceModel}
            placeholder='HUAWEI' onInput={(e) => setField('deviceModel', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>MAC</Text>
          <Input className='form-input' disabled={!editable} value={form.mac}
            placeholder='4HB7S24C26000931' onInput={(e) => setField('mac', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>IMEI</Text>
          <Input className='form-input' disabled={!editable} value={form.imei}
            onInput={(e) => setField('imei', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>主卡号</Text>
          <Input className='form-input' disabled={!editable} value={form.iccid}
            placeholder='8986112320403848756' onInput={(e) => setField('iccid', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>备用卡</Text>
          <Input className='form-input' disabled={!editable} value={form.backupIccid}
            placeholder='89860487152590411606' onInput={(e) => setField('backupIccid', e.detail.value)} />
        </View>
        <View className='form-item'>
          <Text className='form-label'>备注</Text>
          <Input className='form-input' disabled={!editable} value={form.installRemark}
            onInput={(e) => setField('installRemark', e.detail.value)} />
        </View>
        {form.status === '失败' && (
          <View className='form-item'>
            <Text className='form-label'>失败原因</Text>
            <Input className='form-input' disabled={!editable} value={form.failReason}
              onInput={(e) => setField('failReason', e.detail.value)} />
          </View>
        )}
      </View>

      <View className='card preview-card'>
        <Text className='section-title'>登记预览</Text>
        <Text className='preview-text'>{preview}</Text>
      </View>

      {editable && (
        <Button className='btn-primary submit-btn' loading={loading} onClick={handleSubmit}>
          {isCreate ? '提交登记' : '保存修改'}
        </Button>
      )}
      {!editable && !isCreate && (
        <View className='readonly-tip'>仅登记人可修改此记录</View>
      )}
    </View>
  )
}
