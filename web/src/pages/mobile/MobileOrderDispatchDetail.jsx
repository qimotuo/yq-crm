import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Input, Button, Select, Tag, message, Spin } from 'antd'
import {
  createWorkOrder, getWorkOrderDetail, confirmDispatch, getInstallers, dispatchWorkOrder,
  updateWorkOrderStatusWithReason,
} from '../../api/workOrder'
import { formatDispatchRecord, buildDispatchPayload, copyText } from '../../utils/mobileFormat'
import MobileDateField from '../../components/MobileDateField'
import {
  hasOperation, isInstaller, canDispatch,
} from '../../utils/mobileAuth'
import { h5Path } from '../../utils/basePath'

const STATUS_COLOR = {
  待派工: 'default', 已派工: 'processing', 安装成功: 'success', 已安装: 'success',
  失败: 'error', 推迟安装: 'warning',
}

const emptyForm = () => ({
  storeName: '', customerName: '', address: '', contact: '', contactPhone: '', installTimeSlot: '', remark: '', price: '',
})

export default function MobileOrderDispatchDetail() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const recordId = Number(params.get('id') || 0)
  const isCreate = params.get('mode') === 'create' || !recordId

  const [record, setRecord] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(!isCreate)
  const [failReason, setFailReason] = useState('')
  const [postponeDate, setPostponeDate] = useState('')
  const [showFailForm, setShowFailForm] = useState(false)
  const [showPostponeForm, setShowPostponeForm] = useState(false)
  const [installers, setInstallers] = useState([])
  const [installer, setInstaller] = useState('')

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    if (canDispatch()) {
      getInstallers().then((list) => {
        setInstallers(list || [])
        if (list?.length) setInstaller(list[0])
      }).catch(() => setInstallers([]))
    }
    if (isCreate) {
      setForm({
        storeName: params.get('storeName') || '',
        customerName: params.get('customerName') || '',
        address: params.get('address') || '',
        contact: params.get('contact') || '',
        contactPhone: params.get('contactPhone') || '',
        installTimeSlot: params.get('installTimeSlot') || params.get('installDate') || '',
        remark: params.get('remark') || '',
        price: params.get('price') || '',
      })
    } else {
      setPageLoading(true)
      getWorkOrderDetail(recordId).then((item) => {
        setRecord(item)
        setForm({
          storeName: item.storeName || '',
          customerName: item.customerName || '',
          address: item.address || '',
          contact: item.contact || '',
          contactPhone: item.contactPhone || '',
          installTimeSlot: item.installTimeSlot || item.installDate || '',
          remark: item.remark || '',
          price: item.price || '',
        })
      }).finally(() => setPageLoading(false))
    }
  }, [recordId, isCreate, params])

  const handleCreate = async () => {
    if (!form.storeName.trim()) return message.warning('请填写店名')
    if (!form.customerName.trim()) return message.warning('请填写客户名称')
    if (!form.address.trim()) return message.warning('请填写安装地址')
    if (!form.contact.trim()) return message.warning('请填写联系人')
    if (!form.contactPhone.trim()) return message.warning('请填写联系电话')
    if (!hasOperation('workorder:create')) return message.warning('无发单权限')
    setLoading(true)
    try {
      await createWorkOrder(buildDispatchPayload(form))
      message.success('派单已提交')
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (result) => {
    if (!record) return
    if (result === '安装失败' && !failReason.trim()) return message.warning('请填写失败原因')
    if (result === '推迟安装' && !postponeDate) return message.warning('请选择推迟日期')
    setLoading(true)
    try {
      const updated = await confirmDispatch(record.id, result, {
        failReason: failReason.trim(),
        postponeDate,
      })
      setRecord(updated)
      message.success(`已确认：${result}`)
      setShowFailForm(false)
      setShowPostponeForm(false)
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!record || !installer) return message.warning('请选择安装人员')
    setLoading(true)
    try {
      const updated = await dispatchWorkOrder(record.id, installer)
      setRecord(updated)
      message.success('派工成功')
    } finally {
      setLoading(false)
    }
  }

  const goRegister = () => {
    if (!record) return
    const q = new URLSearchParams({
      mode: 'create',
      orderId: String(record.id),
      storeName: record.storeName || '',
      customerName: record.customerName || '',
      installDate: record.installDate || record.installTimeSlot || '',
    })
    navigate(`${h5Path('orders/detail')}?${q}`)
  }

  const canCreate = isCreate && hasOperation('workorder:create')
  const preview = formatDispatchRecord({ ...(record || {}), ...form })
  const fieldStatuses = ['已派工', '推迟安装', '安装中', '安装成功']
  const canStart = isInstaller() && record && ['已派工', '推迟安装'].includes(record.status)
  const canRegister = isInstaller() && record && ['安装中', '安装成功'].includes(record.status)
  const canField = isInstaller() && record && fieldStatuses.includes(record.status)
  const canFinish = canDispatch() && record && record.status === '已安装'
  const canAssign = canDispatch() && record && ['待派工', '失败'].includes(record.status)

  const handleStart = async () => {
    if (!record) return
    setLoading(true)
    try {
      const updated = await updateWorkOrderStatusWithReason(record.id, '安装中')
      setRecord(updated)
      message.success('已开始安装')
    } finally {
      setLoading(false)
    }
  }

  const handleFinish = async () => {
    if (!record) return
    setLoading(true)
    try {
      const updated = await updateWorkOrderStatusWithReason(record.id, '已完成')
      setRecord(updated)
      message.success('已确认完成')
    } finally {
      setLoading(false)
    }
  }

  if (pageLoading) return <Spin style={{ display: 'block', margin: '48px auto' }} />

  return (
    <div className="mobile-form-stack">
      {!isCreate && record && (
        <Card className="mobile-card" size="small">
          <div className="mobile-card__title">
            <strong>{record.orderNo}</strong>
            <Tag color={STATUS_COLOR[record.status]}>{record.status}</Tag>
          </div>
          <div className="mobile-card__row"><span className="label">销售</span><span>{record.salesName || '-'}</span></div>
          {record.installer && (
            <div className="mobile-card__row"><span className="label">安装人</span><span>{record.installer}</span></div>
          )}
        </Card>
      )}

      {canCreate && (
        <Card className="mobile-card" size="small" title="发安装单">
          <div className="mobile-form-stack">
            <div><div className="mobile-field-label">店名 *</div><Input value={form.storeName} onChange={(e) => setField('storeName', e.target.value)} /></div>
            <div><div className="mobile-field-label">客户名称 *</div><Input value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} /></div>
            <div><div className="mobile-field-label">安装地址 *</div><Input value={form.address} onChange={(e) => setField('address', e.target.value)} /></div>
            <div><div className="mobile-field-label">联系人 *</div><Input value={form.contact} onChange={(e) => setField('contact', e.target.value)} /></div>
            <div><div className="mobile-field-label">联系电话 *</div><Input value={form.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} /></div>
            <div>
              <div className="mobile-field-label">预约日期</div>
              <MobileDateField value={form.installTimeSlot} onChange={(v) => setField('installTimeSlot', v)} />
            </div>
            <div><div className="mobile-field-label">备注</div><Input value={form.remark} onChange={(e) => setField('remark', e.target.value)} /></div>
            <div><div className="mobile-field-label">价格</div><Input value={form.price} placeholder="2880 或 2880x2=5760" onChange={(e) => setField('price', e.target.value)} /></div>
            <Button type="primary" block loading={loading} onClick={handleCreate}>提交派单</Button>
          </div>
        </Card>
      )}

      {isCreate && !canCreate && (
        <div className="mobile-empty">无发单权限</div>
      )}

      <Card className="mobile-card" size="small" title="派单预览">
        <pre className="mobile-preview">{preview}</pre>
        {!isCreate && (
          <Button block onClick={async () => {
            if (await copyText(preview)) message.success('已复制')
          }}>复制派单</Button>
        )}
      </Card>

      {canAssign && (
        <Card className="mobile-card" size="small" title="派工">
          <div className="mobile-form-stack">
            <Select value={installer} onChange={setInstaller} options={installers.map((n) => ({ value: n, label: n }))} placeholder="选择安装人员" />
            <Button type="primary" block loading={loading} onClick={handleAssign}>确认派工</Button>
          </div>
        </Card>
      )}

      {canField && (
        <Card className="mobile-card" size="small" title="现场处理">
          <div className="mobile-form-stack">
            {canStart && <Button type="primary" block loading={loading} onClick={handleStart}>开始安装</Button>}
            <Button danger block onClick={() => { setShowFailForm(!showFailForm); setShowPostponeForm(false) }}>安装失败</Button>
            {showFailForm && (
              <>
                <Input.TextArea rows={2} placeholder="失败原因" value={failReason} onChange={(e) => setFailReason(e.target.value)} />
                <Button danger block loading={loading} onClick={() => handleConfirm('安装失败')}>确认失败</Button>
              </>
            )}
            <Button block onClick={() => { setShowPostponeForm(!showPostponeForm); setShowFailForm(false) }}>推迟安装</Button>
            {showPostponeForm && (
              <>
                <MobileDateField value={postponeDate} onChange={setPostponeDate} placeholder="选择推迟日期" />
                <Button block loading={loading} onClick={() => handleConfirm('推迟安装')}>确认推迟</Button>
              </>
            )}
          </div>
        </Card>
      )}

      {canRegister && (
        <Card className="mobile-card" size="small" title="请登记设备信息">
          <Button type="primary" block onClick={goRegister}>去登记设备</Button>
        </Card>
      )}

      {canFinish && (
        <Button type="primary" block loading={loading} onClick={handleFinish}>确认完成</Button>
      )}
    </div>
  )
}
