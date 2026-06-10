import { Card, Row, Col } from 'antd'
import { formatMoney } from '../utils/helpers'

const chartData = [
  { month: '7月', orders: 18, revenue: 42000 },
  { month: '8月', orders: 22, revenue: 51000 },
  { month: '9月', orders: 25, revenue: 58000 },
  { month: '10月', orders: 30, revenue: 65000 },
  { month: '11月', orders: 28, revenue: 87000 },
]

export default function SimpleBarChart({ title, dataKey, format }) {
  const max = Math.max(...chartData.map((d) => d[dataKey]))

  return (
    <Card title={title} size="small">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140, padding: '0 8px' }}>
        {chartData.map((d) => (
          <div key={d.month} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
              {format ? format(d[dataKey]) : d[dataKey]}
            </div>
            <div style={{
              height: `${(d[dataKey] / max) * 100}px`,
              background: 'linear-gradient(180deg, #1677ff, #69b1ff)',
              borderRadius: '4px 4px 0 0',
              minHeight: 4,
              transition: 'height 0.3s',
            }} />
            <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>{d.month}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function DashboardCharts() {
  return (
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={12}>
        <SimpleBarChart title="月度工单趋势" dataKey="orders" />
      </Col>
      <Col xs={24} lg={12}>
        <SimpleBarChart title="月度应收趋势" dataKey="revenue" format={formatMoney} />
      </Col>
    </Row>
  )
}
