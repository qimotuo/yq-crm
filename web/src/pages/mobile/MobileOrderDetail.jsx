import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Input, Button, Select, Modal, message, Spin, Upload } from 'antd'
import { CameraOutlined } from '@ant-design/icons'
import {
  getInstallationDetail, createInstallation, updateInstallation, installRegister, INSTALL_STATUSES,
} from '../../api/workOrder'
import { fileUrl, uploadFile } from '../../api/upload'
import { formatInstallRecord } from '../../utils/mobileFormat'
import { getMobileUser, hasOperation } from '../../utils/mobileAuth'
import { h5Path } from '../../utils/basePath'
import MobileDateField from '../../components/MobileDateField'
import { localToday } from '../../utils/date'

const OPERATORS = ['移动', '电信', '联通']

function toPhotoFileList(urls = []) {
  return (urls || []).filter(Boolean).map((url, i) => ({
    uid: `photo-${i}-${url}`,
    name: `photo-${i + 1}`,
    status: 'done',
    url: fileUrl(url),
    response: { url },
  }))
}

function photoUrls(list) {
  return (list || []).map((f) => {
    const raw = f.response?.url || f.url || ''
    const text = String(raw)
    return text.startsWith('http') ? text.replace(/^https?:\/\/[^/]+/, '') : text
  }).filter(Boolean)
}

const emptyForm = () => ({
  installDate: '', storeName: '', customerName: '', address: '', contact: '', contactPhone: '',
  deviceSupplier: '鲲鹏', deviceModel: '618', mac: '', imei: '', simSupplier: '光和', operator: '移动',
  iccid: '', backupIccid: '', status: '已安装', installRemark: '', failReason: '',
})

export default function MobileOrderDetail() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const recordId = Number(params.get('id') || 0)
  const fromOrderId = Number(params.get('orderId') || 0)
  const isCreate = params.get('mode') === 'create' || !recordId

  const user = getMobileUser()
  const [record, setRecord] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(!isCreate || !!fromOrderId)

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const fillFromOrder = (item, overrides = {}) => {
    setRecord(item)
    setPhotos(toPhotoFileList(item?.installPhotos))
    setForm({
      installDate: overrides.installDate ?? item?.installDate ?? '',
      storeName: overrides.storeName ?? item?.storeName ?? '',
      customerName: overrides.customerName ?? item?.customerName ?? '',
      address: item?.address || '',
      contact: item?.contact || '',
      contactPhone: item?.contactPhone || '',
      deviceSupplier: item?.deviceSupplier || '鲲鹏',
      deviceModel: item?.deviceModel || '618',
      mac: item?.mac || '',
      imei: item?.imei || '',
      simSupplier: item?.simSupplier || '光和',
      operator: item?.operator || '移动',
      iccid: item?.iccid || '',
      backupIccid: item?.backupIccid || '',
      status: overrides.status ?? item?.status ?? '已安装',
      installRemark: item?.installRemark || '',
      failReason: item?.failReason || '',
    })
  }

  useEffect(() => {
    if (isCreate && !fromOrderId) {
      setRecord(null)
      setPhotos([])
      setForm({
        ...emptyForm(),
        installDate: params.get('installDate') || localToday(),
        storeName: params.get('storeName') || '',
        customerName: params.get('customerName') || '',
      })
      setPageLoading(false)
      return
    }
    const id = isCreate ? fromOrderId : recordId
    setPageLoading(true)
    getInstallationDetail(id).then((item) => {
      fillFromOrder(item, isCreate ? { status: '已安装' } : {})
    }).finally(() => setPageLoading(false))
  }, [recordId, fromOrderId, isCreate, params])

  const canEdit = () => {
    if (isCreate) return true
    if (!record) return false
    return user?.role === 'admin' || record.installer === user?.name
  }

  const editable = canEdit() || (isCreate && !!fromOrderId)

  const promptStockOut = (order) => {
    if (!hasOperation('stock:out') || !form.mac) {
      navigate(-1)
      return
    }
    const q = new URLSearchParams({
      orderNo: order.orderNo || '',
      model: form.deviceModel || order.deviceModel || '设备',
      mac: form.mac,
      imei: form.imei || '',
      iccid: form.iccid || '',
      iccid2: form.backupIccid || '',
      operator: order.operator || '',
      storeName: form.storeName || order.storeName || '',
      customerName: form.customerName || order.customerName || '',
      address: order.address || '',
    })
    Modal.confirm({
      title: '登记完成',
      content: '是否办理设备出库？',
      okText: '去出库',
      cancelText: '稍后',
      onOk: () => navigate(`${h5Path('stock/out')}?${q}`),
      onCancel: () => navigate(-1),
    })
  }

  const handleSubmit = async () => {
    if (!form.storeName && !form.customerName) return message.warning('请填写门店或客户名称')
    if (!form.deviceSupplier || !form.deviceModel || !form.mac || !form.imei) {
      return message.warning('请填写设备供应商、型号、MAC、IMEI')
    }
    if (!canEdit()) return message.warning('只能修改自己的登记')
    setLoading(true)
    try {
      const payload = {
        ...form,
        customerName: form.customerName || form.storeName,
        installPhotos: photoUrls(photos),
      }
      if (isCreate) payload.status = '已安装'
      let saved = null
      if (isCreate && fromOrderId) {
        saved = await installRegister(fromOrderId, payload)
        message.success('登记完成')
      } else if (isCreate) {
        saved = await createInstallation(payload)
        message.success('登记已创建')
      } else {
        saved = await updateInstallation(recordId, payload)
        message.success('已保存')
      }
      if (saved && isCreate && fromOrderId) promptStockOut(saved)
      else navigate(-1)
    } finally {
      setLoading(false)
    }
  }

  const preview = formatInstallRecord({ ...(record || {}), ...form, customerName: form.customerName || form.storeName })

  if (pageLoading) return <Spin style={{ display: 'block', margin: '48px auto' }} />

  return (
    <div className="mobile-form-stack">
      {!isCreate && record && (
        <Card className="mobile-card" size="small">
          <div className="mobile-card__title"><strong>{record.orderNo}</strong></div>
          <div className="mobile-card__row"><span className="label">登记人</span><span>{record.installer || '-'}</span></div>
          {record.address && <div className="mobile-card__row"><span className="label">地址</span><span>{record.address}</span></div>}
          {(record.contact || record.contactPhone) && (
            <div className="mobile-card__row"><span className="label">联系人</span><span>{record.contact || '-'} {record.contactPhone || ''}</span></div>
          )}
          {record.price && <div className="mobile-card__row"><span className="label">价格</span><span>{record.price}</span></div>}
        </Card>
      )}

      <Card className="mobile-card" size="small" title={isCreate ? '新增安装登记' : '登记信息'}>
        <div className="mobile-form-stack">
          {!isCreate && (
            <div>
              <div className="mobile-field-label">状态</div>
              <Select disabled={!editable} value={form.status} onChange={(v) => setField('status', v)}
                options={INSTALL_STATUSES.map((v) => ({ value: v, label: v }))} />
            </div>
          )}
          <div>
            <div className="mobile-field-label">期（安装日期）</div>
            <MobileDateField disabled={!editable} value={form.installDate} onChange={(v) => setField('installDate', v)} />
          </div>
          <div><div className="mobile-field-label">门店 *</div><Input disabled={!editable} value={form.storeName} onChange={(e) => setField('storeName', e.target.value)} /></div>
          <div><div className="mobile-field-label">客户名称</div><Input disabled={!editable} value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} /></div>
          <div><div className="mobile-field-label">设备供应商 *</div><Input disabled={!editable} value={form.deviceSupplier} onChange={(e) => setField('deviceSupplier', e.target.value)} /></div>
          <div><div className="mobile-field-label">设备型号 *</div><Input disabled={!editable} value={form.deviceModel} onChange={(e) => setField('deviceModel', e.target.value)} /></div>
          <div><div className="mobile-field-label">MAC *</div><Input disabled={!editable} value={form.mac} onChange={(e) => setField('mac', e.target.value)} /></div>
          <div><div className="mobile-field-label">IMEI *</div><Input disabled={!editable} value={form.imei} onChange={(e) => setField('imei', e.target.value)} /></div>
          <div><div className="mobile-field-label">卡供应商</div><Input disabled={!editable} value={form.simSupplier} onChange={(e) => setField('simSupplier', e.target.value)} /></div>
          <div>
            <div className="mobile-field-label">运营商</div>
            <Select disabled={!editable} allowClear value={form.operator || undefined} onChange={(v) => setField('operator', v || '')}
              options={OPERATORS.map((v) => ({ value: v, label: v }))} />
          </div>
          <div><div className="mobile-field-label">主卡 ICCID</div><Input disabled={!editable} value={form.iccid} onChange={(e) => setField('iccid', e.target.value)} /></div>
          <div><div className="mobile-field-label">备用卡 ICCID</div><Input disabled={!editable} value={form.backupIccid} onChange={(e) => setField('backupIccid', e.target.value)} /></div>
          <div><div className="mobile-field-label">安装备注</div><Input.TextArea disabled={!editable} rows={2} value={form.installRemark} onChange={(e) => setField('installRemark', e.target.value)} /></div>
          <div>
            <div className="mobile-field-label">现场照片</div>
            <Upload disabled={!editable} listType="picture-card" maxCount={3} accept="image/*" fileList={photos}
              customRequest={async ({ file, onSuccess, onError }) => {
                try {
                  const data = await uploadFile(file, 'install')
                  onSuccess({ ...data, url: fileUrl(data.url) })
                } catch (e) {
                  onError(e)
                  message.error(e.message || '上传失败')
                }
              }}
              onChange={({ fileList }) => setPhotos(fileList)}>
              {editable && photos.length < 3 && <div><CameraOutlined /><div style={{ fontSize: 12 }}>拍照</div></div>}
            </Upload>
          </div>
          {form.status === '失败' && (
            <div><div className="mobile-field-label">失败原因</div><Input disabled={!editable} value={form.failReason} onChange={(e) => setField('failReason', e.target.value)} /></div>
          )}
        </div>
      </Card>

      <Card className="mobile-card" size="small" title="登记预览">
        <pre className="mobile-preview">{preview}</pre>
      </Card>

      {editable && (
        <Button type="primary" block loading={loading} onClick={handleSubmit}>
          {isCreate ? '提交登记' : '保存修改'}
        </Button>
      )}
      {!editable && !isCreate && <div className="mobile-empty">仅登记人可修改此记录</div>}
    </div>
  )
}
