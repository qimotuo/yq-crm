import { Card, Row, Col, Empty } from 'antd'
import { formatMoney } from '../utils/helpers'

export default function SimpleBarChart({ title, dataKey, format, chartData = [], barColor = '#1677ff' }) {
  const max = Math.max(...chartData.map((d) => d[dataKey]), 1)
  const hasData = chartData.some((d) => d[dataKey] > 0)

  return (
    <Card title={title} className="dashboard-chart-card" styles={{ body: { padding: '12px 16px 16px' } }}>
      {!hasData ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无趋势数据" style={{ margin: '24px 0' }} />
      ) : (
        <div className="dashboard-chart-bars">
          {chartData.map((d) => (
            <div key={d.month} className="dashboard-chart-bar-col">
              <div className="dashboard-chart-bar-value">
                {format ? format(d[dataKey]) : d[dataKey]}
              </div>
              <div className="dashboard-chart-bar-track">
                <div
                  className="dashboard-chart-bar-fill"
                  style={{
                    height: `${Math.max((d[dataKey] / max) * 100, 4)}%`,
                    background: `linear-gradient(180deg, ${barColor}, ${barColor}88)`,
                  }}
                />
              </div>
              <div className="dashboard-chart-bar-label">{d.month}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export function DashboardCharts({ monthlyTrends = [] }) {
  return (
    <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
      <Col xs={24} lg={12}>
        <SimpleBarChart title="月度工单趋势" dataKey="orders" chartData={monthlyTrends} />
      </Col>
      <Col xs={24} lg={12}>
        <SimpleBarChart title="月度应收趋势" dataKey="revenue" format={formatMoney} chartData={monthlyTrends} barColor="#52c41a" />
      </Col>
    </Row>
  )
}
