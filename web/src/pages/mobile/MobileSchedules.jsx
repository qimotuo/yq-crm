import { useEffect, useState } from 'react'
import { Card, Button, Tag, Spin, message, Input, Select } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getSchedules, completeSchedule, createSchedule } from '../../api/notify'
import MobileDateField from '../../components/MobileDateField'
import { localToday } from '../../utils/date'
import { getMobileUser } from '../../utils/mobileAuth'

const TYPES = ['上门', '电话', '安装']

const TYPE_COLOR = { 上门: 'orange', 电话: 'blue', 安装: 'green' }

export default function MobileSchedules() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', customerName: '', date: localToday(), time: '14:00', type: '上门' })
  const today = localToday()

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await getSchedules()
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }

  const todayPending = list.filter((s) => s.date === today && s.status === '待执行')

  const handleCreate = async () => {
    if (!form.title.trim() || !form.customerName.trim() || !form.date || !form.time.trim()) {
      return message.warning('请填写标题、客户、日期和时间')
    }
    await createSchedule({ ...form, salesName: getMobileUser()?.name || '' })
    message.success('日程已添加')
    setShowForm(false)
    setForm({ title: '', customerName: '', date: localToday(), time: '14:00', type: '上门' })
    load()
  }

  const handleComplete = async (id) => {
    const res = await completeSchedule(id)
    message.success(res.followUp ? '已完成并写入跟进' : '已完成')
    load()
  }

  return (
    <div>
      <Button type="primary" block icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setShowForm(!showForm)}>
        {showForm ? '取消' : '添加日程'}
      </Button>
      {showForm && (
        <Card className="mobile-card" size="small" style={{ marginBottom: 12 }}>
          <div className="mobile-form-stack">
            <Input placeholder="标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="客户" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            <MobileDateField value={form.date} onChange={(v) => setForm({ ...form, date: v })} placeholder="日期" />
            <Input placeholder="时间，如 14:00" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <Select value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={TYPES.map((v) => ({ value: v, label: v }))} />
            <Button type="primary" block onClick={handleCreate}>保存</Button>
          </div>
        </Card>
      )}
      {todayPending.length > 0 && (
        <Card className="mobile-card mobile-card--banner" size="small">
          <strong>今日待办 {todayPending.length} 项</strong>
          {todayPending.map((s) => (
            <div key={s.id} style={{ fontSize: 13, marginTop: 4, color: '#666' }}>
              {s.time} {s.title} · {s.customerName}
            </div>
          ))}
        </Card>
      )}

      <Spin spinning={loading}>
        {list.length === 0 && !loading && <div className="mobile-empty">暂无日程</div>}
        {list.map((s) => (
          <Card key={s.id} className="mobile-card" size="small">
            <div className="mobile-card__title">
              <strong>{s.title}</strong>
              <Tag color={TYPE_COLOR[s.type]}>{s.type}</Tag>
            </div>
            <div className="mobile-card__row"><span className="label">客户</span><span>{s.customerName}</span></div>
            <div className="mobile-card__row"><span className="label">销售</span><span>{s.salesName || '-'}</span></div>
            <div className="mobile-card__row"><span className="label">时间</span><span>{s.date} {s.time}</span></div>
            <div className="mobile-card__row"><span className="label">状态</span><span>{s.status}</span></div>
            {s.status === '待执行' && (
              <Button type="primary" size="small" block style={{ marginTop: 8 }} onClick={() => handleComplete(s.id)}>
                标记完成
              </Button>
            )}
          </Card>
        ))}
      </Spin>
    </div>
  )
}
