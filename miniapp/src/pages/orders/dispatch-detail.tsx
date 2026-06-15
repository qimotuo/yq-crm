import { useState } from 'react'
import { View, Text, Input, Button, Picker } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import {
  createWorkOrder,
  getWorkOrderDetail,
  confirmDispatch,
  getInstallers,
  dispatchWorkOrder,
  type WorkOrder,
} from '@/api/workOrder'
import { formatDispatchRecord, buildDispatchPayload } from '@/utils/dispatchFormat'
import { hasOperation, isInstaller, isSales, canDispatch } from '@/utils/auth'
import './dispatch-detail.scss'

const emptyForm = () => ({
  storeName: '',
  address: '',
  contact: '',
  contactPhone: '',
  installTimeSlot: '',
  remark: '',
  price: '',
})

const STATUS_CLASS: Record<string, string> = {
  待派工: 'status-pending',
  已派工: 'status-dispatched',
  安装成功: 'status-success',
  已安装: 'status-success',
  失败: 'status-fail',
  推迟安装: 'status-postpone',
}

export default function DispatchDetailPage() {
  const router = useRouter()
  const recordId = router.params.id ? Number(router.params.id) : 0
  const isCreate = router.params.mode === 'create' || !recordId
  const [record, setRecord] = useState<WorkOrder | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [loading, setLoading] = useState(false)
  const [failReason, setFailReason] = useState('')
  const [postponeDate, setPostponeDate] = useState('')
  const [showFailForm, setShowFailForm] = useState(false)
  const [showPostponeForm, setShowPostponeForm] = useState(false)
  const [installers, setInstallers] = useState<string[]>([])
  const [installerIdx, setInstallerIdx] = useState(0)

  const loadInstallers = async () => {
    if (!canDispatch()) return
    try {
      const list = await getInstallers()
      setInstallers(list || [])
    } catch {
      setInstallers([])
    }
  }

  const loadRecord = async () => {
    if (!recordId) return
    try {
      const item = await getWorkOrderDetail(recordId)
      setRecord(item)
      setForm({
        storeName: item.storeName || '',
        address: item.address || '',
        contact: item.contact || '',
        contactPhone: item.contactPhone || '',
        installTimeSlot: item.installTimeSlot || item.installDate || '',
        remark: item.remark || '',
        price: item.price || '',
      })
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  }

  useDidShow(() => {
    if (isCreate) {
      setForm(emptyForm())
    } else {
      loadRecord()
    }
    loadInstallers()
  })

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleCreate = async () => {
    if (!form.storeName.trim()) {
      Taro.showToast({ title: '请填写店名', icon: 'none' })
      return
    }
    if (!hasOperation('workorder:create')) {
      Taro.showToast({ title: '无发单权限', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      await createWorkOrder(buildDispatchPayload(form))
      Taro.showToast({ title: '派单已提交', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (result: string) => {
    if (!record) return
    if (result === '安装失败' && !failReason.trim()) {
      Taro.showToast({ title: '请填写失败原因', icon: 'none' })
      return
    }
    if (result === '推迟安装' && !postponeDate.trim()) {
      Taro.showToast({ title: '请填写推迟日期', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const updated = await confirmDispatch(record.id, result, {
        failReason: failReason.trim(),
        postponeDate: postponeDate.trim(),
      })
      setRecord(updated)
      Taro.showToast({ title: `已确认：${result}`, icon: 'success' })
      setShowFailForm(false)
      setShowPostponeForm(false)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!record || installers.length === 0) {
      Taro.showToast({ title: '请选择安装人员', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const updated = await dispatchWorkOrder(record.id, installers[installerIdx])
      setRecord(updated)
      Taro.showToast({ title: '派工成功', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const goRegister = () => {
    if (!record) return
    const q = [
      `storeName=${encodeURIComponent(record.storeName || '')}`,
      `customerName=${encodeURIComponent(record.customerName || record.storeName || '')}`,
      `installDate=${encodeURIComponent(record.installDate || record.installTimeSlot || '')}`,
      `orderId=${record.id}`,
    ].join('&')
    Taro.navigateTo({ url: `/pages/orders/detail?mode=create&${q}` })
  }

  const preview = formatDispatchRecord({ ...(record || {}), ...form } as WorkOrder)
  const canConfirm = isInstaller() && record && ['已派工', '推迟安装'].includes(record.status)
  const canRegister = isInstaller() && record && record.status === '安装成功'
  const canAssign = canDispatch() && record && ['待派工', '失败'].includes(record.status)

  return (
    <View className='dispatch-detail container'>
      {!isCreate && record && (
        <View className='card'>
          <View className='card-row'>
            <Text className='card-title'>{record.orderNo}</Text>
            <Text className={`status-tag ${STATUS_CLASS[record.status] || ''}`}>{record.status}</Text>
          </View>
          <View className='card-row'>
            <Text className='label'>销售</Text>
            <Text>{record.salesName || '-'}</Text>
          </View>
          {record.installer && (
            <View className='card-row'>
              <Text className='label'>安装人</Text>
              <Text>{record.installer}</Text>
            </View>
          )}
        </View>
      )}

      {isCreate && isSales() && (
        <View className='card'>
          <Text className='section-title'>发安装单</Text>
          <View className='form-item'>
            <Text className='form-label'>店名 *</Text>
            <Input className='form-input' value={form.storeName} placeholder='椿作台州卤煮小馆（世博天地）'
              onInput={(e) => setField('storeName', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>地址</Text>
            <Input className='form-input' value={form.address} placeholder='浦东世博天地'
              onInput={(e) => setField('address', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>联系人</Text>
            <Input className='form-input' value={form.contact} placeholder='毒蛇面馆的戴店长'
              onInput={(e) => setField('contact', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>联系人电话</Text>
            <Input className='form-input' value={form.contactPhone} type='number'
              onInput={(e) => setField('contactPhone', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>时间</Text>
            <Input className='form-input' value={form.installTimeSlot} placeholder='6/13号  上午'
              onInput={(e) => setField('installTimeSlot', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>备注</Text>
            <Input className='form-input' value={form.remark} placeholder='新店   上2台主备线用'
              onInput={(e) => setField('remark', e.detail.value)} />
          </View>
          <View className='form-item'>
            <Text className='form-label'>价格</Text>
            <Input className='form-input' value={form.price} placeholder='2880x2=5760'
              onInput={(e) => setField('price', e.detail.value)} />
          </View>
          <Button className='btn-primary submit-btn' loading={loading} onClick={handleCreate}>
            提交派单
          </Button>
        </View>
      )}

      <View className='card preview-card'>
        <Text className='section-title'>派单预览</Text>
        <Text className='preview-text'>{preview}</Text>
        {!isCreate && (
          <Button className='btn-primary submit-btn' onClick={() => Taro.setClipboardData({ data: preview })}>
            复制派单
          </Button>
        )}
      </View>

      {canAssign && (
        <View className='card confirm-section'>
          <Text className='confirm-title'>派工</Text>
          <View className='form-item'>
            <Text className='form-label'>安装人员</Text>
            <Picker
              mode='selector'
              range={installers}
              value={installerIdx}
              onChange={(e) => setInstallerIdx(Number(e.detail.value))}
            >
              <View className='form-input picker-value'>
                {installers[installerIdx] || '请选择'}
              </View>
            </Picker>
          </View>
          <Button className='btn-primary submit-btn' loading={loading} onClick={handleAssign}>
            确认派工
          </Button>
        </View>
      )}

      {canConfirm && (
        <View className='card confirm-section'>
          <Text className='confirm-title'>现场确认</Text>
          <View className='confirm-btns'>
            <Button className='btn-success' loading={loading} onClick={() => handleConfirm('安装成功')}>
              安装成功
            </Button>
            <Button className='btn-fail' onClick={() => { setShowFailForm(!showFailForm); setShowPostponeForm(false) }}>
              安装失败
            </Button>
            {showFailForm && (
              <View className='extra-form'>
                <View className='form-item'>
                  <Text className='form-label'>失败原因</Text>
                  <Input className='form-input' value={failReason} placeholder='如：客户不在场、线路未通'
                    onInput={(e) => setFailReason(e.detail.value)} />
                </View>
                <Button className='btn-fail' loading={loading} onClick={() => handleConfirm('安装失败')}>
                  确认失败
                </Button>
              </View>
            )}
            <Button className='btn-postpone' onClick={() => { setShowPostponeForm(!showPostponeForm); setShowFailForm(false) }}>
              推迟安装
            </Button>
            {showPostponeForm && (
              <View className='extra-form'>
                <View className='form-item'>
                  <Text className='form-label'>推迟日期</Text>
                  <Input className='form-input' value={postponeDate} placeholder='如 6/15号 上午'
                    onInput={(e) => setPostponeDate(e.detail.value)} />
                </View>
                <Button className='btn-postpone' loading={loading} onClick={() => handleConfirm('推迟安装')}>
                  确认推迟
                </Button>
              </View>
            )}
          </View>
        </View>
      )}

      {canRegister && (
        <View className='card'>
          <Text className='confirm-title'>安装成功，请登记设备信息</Text>
          <Button className='btn-register' onClick={goRegister}>去登记设备</Button>
        </View>
      )}
    </View>
  )
}
