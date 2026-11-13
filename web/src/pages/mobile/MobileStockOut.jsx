import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Input, Button, Select, DatePicker, message } from 'antd'
import dayjs from 'dayjs'
import { createStockOut } from '../../api'
import { hasOperation } from '../../utils/mobileAuth'
import { getMobileUser } from '../../utils/mobileAuth'

const OPERATORS = ['中国移动', '中国电信', '中国联通']
const OPERATOR_ALIAS = { 移动: '中国移动', 电信: '中国电信', 联通: '中国联通' }

function normalizeOperator(value) {
  if (!value) return ''
  return OPERATOR_ALIAS[value] || value
}

export default function MobileStockOut() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const user = getMobileUser()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    outDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    orderNo: '', model: '', mac: '', imei: '', iccid: '', iccid2: '',
    operator: '', storeName: '', customerName: '', address: '', remark: '',
    mobileNo: '', telecomNo: '', replacedCardNo: '',
  })

  useEffect(() => {
    if (!hasOperation('stock:out')) {
      message.warning('无出库权限')
      navigate(-1)
      return
    }
    setForm({
      outDate: params.get('outDate') || dayjs().format('YYYY-MM-DD HH:mm:ss'),
      orderNo: params.get('orderNo') || '',
      model: params.get('model') || '',
      mac: params.get('mac') || '',
      imei: params.get('imei') || '',
      iccid: params.get('iccid') || '',
      iccid2: params.get('iccid2') || '',
      operator: normalizeOperator(params.get('operator') || ''),
      storeName: params.get('storeName') || '',
      customerName: params.get('customerName') || '',
      address: params.get('address') || '',
      mobileNo: params.get('mobileNo') || '',
      telecomNo: params.get('telecomNo') || '',
      replacedCardNo: params.get('replacedCardNo') || '',
      remark: '',
    })
  }, [params])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    if (!form.outDate || !form.orderNo || !form.model || !form.mac) {
      return message.warning('出库时间、工单号、型号、MAC 必填')
    }
    setLoading(true)
    try {
      await createStockOut({ ...form, receiver: user?.name || '' })
      message.success('出库成功')
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mobile-form-stack">
      <p style={{ fontSize: 13, color: '#666' }}>安装登记后可在此办理设备出库</p>
      <Card className="mobile-card" size="small" title="出库信息">
        <div className="mobile-form-stack">
          <div>
            <div className="mobile-field-label">出库时间 *</div>
            <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss"
              value={form.outDate ? dayjs(form.outDate) : null}
              onChange={(v) => setField('outDate', v ? v.format('YYYY-MM-DD HH:mm:ss') : '')} />
          </div>
          <div><div className="mobile-field-label">工单号 *</div><Input value={form.orderNo} onChange={(e) => setField('orderNo', e.target.value)} /></div>
          <div><div className="mobile-field-label">店名</div><Input value={form.storeName} onChange={(e) => setField('storeName', e.target.value)} /></div>
          <div><div className="mobile-field-label">设备型号 *</div><Input value={form.model} onChange={(e) => setField('model', e.target.value)} /></div>
          <div><div className="mobile-field-label">MAC *</div><Input value={form.mac} onChange={(e) => setField('mac', e.target.value)} /></div>
          <div><div className="mobile-field-label">IMEI</div><Input value={form.imei} onChange={(e) => setField('imei', e.target.value)} /></div>
          <div><div className="mobile-field-label">移动卡号</div><Input value={form.mobileNo} onChange={(e) => setField('mobileNo', e.target.value)} /></div>
          <div><div className="mobile-field-label">电信卡号</div><Input value={form.telecomNo} onChange={(e) => setField('telecomNo', e.target.value)} /></div>
          <div><div className="mobile-field-label">已更换旧卡号</div><Input value={form.replacedCardNo} onChange={(e) => setField('replacedCardNo', e.target.value)} /></div>
          <div><div className="mobile-field-label">主卡 ICCID</div><Input value={form.iccid} onChange={(e) => setField('iccid', e.target.value)} /></div>
          <div><div className="mobile-field-label">备用卡 ICCID</div><Input value={form.iccid2} onChange={(e) => setField('iccid2', e.target.value)} /></div>
          <div>
            <div className="mobile-field-label">运营商</div>
            <Select value={form.operator || undefined} onChange={(v) => setField('operator', v)}
              options={OPERATORS.map((v) => ({ value: v, label: v }))} placeholder="请选择" allowClear />
          </div>
          <div><div className="mobile-field-label">备注</div><Input value={form.remark} onChange={(e) => setField('remark', e.target.value)} /></div>
          <Button type="primary" block loading={loading} onClick={handleSubmit}>确认出库</Button>
        </div>
      </Card>
    </div>
  )
}
