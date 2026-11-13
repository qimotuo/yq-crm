import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Button, Select, Input, Tag, message, Spin } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getFollowUps, createFollowUp } from '../../api'
import { hasOperation, getMobileUser } from '../../utils/mobileAuth'

const TYPES = ['电话', '微信', '上门']
const STATUSES = ['已完成', '待完成']
const typeColor = { 电话: 'blue', 微信: 'green', 上门: 'orange' }
const statusColor = { 已完成: 'success', 待完成: 'warning' }

export default function MobileFollowUps() {
  const [params] = useSearchParams()
  const customerId = Number(params.get('customerId') || 0) || undefined
  const customerName = params.get('customerName') ? decodeURIComponent(params.get('customerName')) : ''

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: '电话', content: '', nextPlan: '', status: '待完成' })

  const load = async () => {
    setLoading(true)
    try {
      const res = await getFollowUps(customerId ? { customerId } : {})
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [customerId])

  const handleSubmit = async () => {
    if (!customerId || !customerName) return message.warning('请从客户详情进入新增')
    if (!form.content) return message.warning('请填写跟进内容')
    await createFollowUp({
      customerId,
      customerName,
      ...form,
      salesName: getMobileUser()?.name || '',
      status: form.status || (form.nextPlan ? '待完成' : '已完成'),
    })
    message.success('已保存')
    setShowForm(false)
    setForm({ type: '电话', content: '', nextPlan: '', status: '待完成' })
    load()
  }

  return (
    <div>
      {customerId && customerName && hasOperation('follow:create') && (
        <Button type="primary" block icon={<PlusOutlined />} style={{ marginBottom: 12 }}
          onClick={() => setShowForm(!showForm)}>
          {showForm ? '取消' : `新增跟进 · ${customerName}`}
        </Button>
      )}

      {showForm && (
        <Card className="mobile-card" size="small" style={{ marginBottom: 12 }}>
          <div className="mobile-form-stack">
            <Select value={form.type} onChange={(v) => setForm({ ...form, type: v })}
              options={TYPES.map((v) => ({ value: v, label: v }))} />
            <Input.TextArea rows={3} placeholder="跟进内容" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            <Input placeholder="下次计划，如 2026-06-12 回访" value={form.nextPlan} onChange={(e) => setForm({ ...form, nextPlan: e.target.value })} />
            <Select value={form.status} onChange={(v) => setForm({ ...form, status: v })}
              options={STATUSES.map((v) => ({ value: v, label: v }))} />
            <Button type="primary" block onClick={handleSubmit}>保存</Button>
          </div>
        </Card>
      )}

      <Spin spinning={loading}>
        {list.length === 0 && !loading && <div className="mobile-empty">暂无跟进记录</div>}
        {list.map((item) => (
          <Card key={item.id} className="mobile-card" size="small">
            <div className="mobile-card__title">
              <strong>{item.customerName}</strong>
              <span>
                <Tag color={typeColor[item.type]}>{item.type}</Tag>
                <Tag color={statusColor[item.status] || 'default'}>{item.status || '已完成'}</Tag>
              </span>
            </div>
            {item.storeName && <div className="mobile-card__row"><span className="label">店名</span><span>{item.storeName}</span></div>}
            {item.salesName && <div className="mobile-card__row"><span className="label">销售</span><span>{item.salesName}</span></div>}
            <p style={{ margin: '8px 0', fontSize: 14 }}>{item.content}</p>
            {item.nextPlan && <div className="mobile-card__row"><span className="label">下次</span><span>{item.nextPlan}</span></div>}
            <div style={{ fontSize: 12, color: '#999' }}>{item.createTime}</div>
          </Card>
        ))}
      </Spin>
    </div>
  )
}
