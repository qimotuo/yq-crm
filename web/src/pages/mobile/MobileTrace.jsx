import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Input, Button, Card, message, Spin } from 'antd'
import { traceQuery } from '../../api'
import { canTrace } from '../../utils/mobileAuth'

const TRACE_TYPES = [
  { value: 'orderNo', label: '工单号', placeholder: 'GD-20261025-088' },
  { value: 'mac', label: 'MAC', placeholder: 'AA:BB:CC:DD:EE:01' },
  { value: 'iccid', label: 'ICCID', placeholder: '89860123456789012345' },
  { value: 'customer', label: '客户', placeholder: '智慧社区A区物业' },
  { value: 'contractNo', label: '合同号', placeholder: 'SH20261105001' },
]

export default function MobileTrace() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [type, setType] = useState('orderNo')
  const [value, setValue] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!canTrace()) {
      message.warning('无追溯权限')
      navigate(-1)
      return
    }
    const initType = params.get('type') || 'orderNo'
    const initValue = params.get('value') ? decodeURIComponent(params.get('value')) : ''
    if (TRACE_TYPES.some((t) => t.value === initType)) setType(initType)
    if (initValue) {
      setValue(initValue)
      runSearch(initType, initValue)
    }
  }, [])

  const runSearch = async (traceType, kw) => {
    if (!kw.trim()) return message.warning('请输入查询关键字')
    setLoading(true)
    try {
      setResult(await traceQuery(traceType, kw.trim()))
    } finally {
      setLoading(false)
    }
  }

  const current = TRACE_TYPES.find((t) => t.value === type)

  return (
    <div>
      <div className="mobile-chip-row">
        {TRACE_TYPES.map((t) => (
          <button key={t.value} type="button"
            className={`mobile-chip${type === t.value ? ' mobile-chip--active' : ''}`}
            onClick={() => setType(t.value)}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Input value={value} placeholder={current?.placeholder} onChange={(e) => setValue(e.target.value)} />
        <Button type="primary" loading={loading} onClick={() => runSearch(type, value)}>查询</Button>
      </div>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>演示: 智慧社区 / GD-20261025 / AA:BB:CC / SH20261105001</p>

      <Spin spinning={loading}>
        {result ? (
          <Card className="mobile-card" size="small" title={`链路：${result.key}`}>
            {result.steps.map((step, i) => (
              <div key={i} className="mobile-trace-step">{step}</div>
            ))}
          </Card>
        ) : (
          !loading && <div className="mobile-empty">输入关键字开始追溯</div>
        )}
      </Spin>
    </div>
  )
}
