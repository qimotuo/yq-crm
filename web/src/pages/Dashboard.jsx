import { useEffect, useState, useMemo, useCallback } from 'react'
import { Row, Col, Card, Table, Button, Empty } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, TeamOutlined,
  DollarOutlined, CalendarOutlined, FileProtectOutlined, MessageOutlined,
  RightOutlined, WarningOutlined,
} from '@ant-design/icons'
import { getDashboardStats } from '../api'
import { getWorkOrders } from '../api/workOrder'
import { OrderStatusTag } from '../components/StatusTag'
import { formatMoney } from '../utils/helpers'
import { APP_NAME } from '../constants/app'
import { DashboardCharts } from '../components/SimpleChart'
import { selectPermissions } from '../store/authSlice'
import { resolveMenuPath } from '../rbac/utils'

const TODO_DEFS = [
  { title: '待派工单', countKey: 'pendingDispatch', color: '#1677ff', paths: ['/dispatch', '/work-orders'] },
  { title: '安装中', countKey: 'installing', color: '#faad14', paths: ['/install-register', '/dispatch', '/work-orders'] },
  { title: '今日日程', countKey: 'todaySchedules', color: '#722ed1', paths: ['/schedules'] },
  { title: '公海客户', countKey: 'publicPoolCount', color: '#9254de', paths: ['/public-pool'] },
  { title: '回款逾期', countKey: 'overdueCount', color: '#ff4d4f', paths: ['/finance'] },
  { title: '库存预警', countKey: 'lowStockCount', color: '#fa8c16', paths: ['/stock'] },
]

function StatCard({ title, value, icon, color = '#1677ff', suffix, formatter, onClick }) {
  const display = formatter ? formatter(value) : value
  return (
    <Card className="dashboard-stat" hoverable={!!onClick} onClick={onClick} styles={{ body: { padding: '16px 20px' } }}>
      <div className="dashboard-stat__inner">
        <div className="dashboard-stat__info">
          <div className="dashboard-stat__title">{title}</div>
          <div className="dashboard-stat__value" style={{ color }}>
            {display}{suffix && <span className="dashboard-stat__suffix">{suffix}</span>}
          </div>
        </div>
        <div className="dashboard-stat__icon" style={{ background: `${color}14`, color }}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

function SectionTitle({ children }) {
  return <div className="dashboard-section-title">{children}</div>
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const navigate = useNavigate()
  const permissions = useSelector(selectPermissions)

  const navTo = useCallback((...paths) => {
    const path = resolveMenuPath(permissions, paths)
    if (path) navigate(path)
  }, [permissions, navigate])

  const clickable = useCallback((...paths) => (
    resolveMenuPath(permissions, paths) ? () => navTo(...paths) : undefined
  ), [permissions, navTo])

  useEffect(() => {
    getDashboardStats().then(setStats)
    getWorkOrders({}).then((res) => setRecentOrders(res.list.slice(0, 5)))
  }, [])

  const todoItems = useMemo(() => TODO_DEFS.map((def) => ({
    ...def,
    count: stats?.[def.countKey] || 0,
    path: resolveMenuPath(permissions, def.paths),
  })), [stats, permissions])

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2>工作台</h2>
        <p>{APP_NAME} 数据概览</p>
      </div>

      <SectionTitle>工单与客户</SectionTitle>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="工单总数" value={stats?.totalOrders || 0} icon={<FileTextOutlined />} color="#1677ff" onClick={clickable('/work-orders', '/work-order-query', '/install-register')} />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="待派工" value={stats?.pendingDispatch || 0} icon={<ClockCircleOutlined />} color="#1677ff" onClick={clickable('/dispatch', '/work-orders')} />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="已完成" value={stats?.completed || 0} icon={<CheckCircleOutlined />} color="#52c41a" onClick={clickable('/work-orders', '/work-order-query', '/install-register')} />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="客户总数" value={stats?.totalCustomers || 0} icon={<TeamOutlined />} color="#13c2c2" onClick={clickable('/customers', '/my-customers')} />
        </Col>
      </Row>

      <SectionTitle>财务与合同</SectionTitle>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="本月应收" value={stats?.monthlyRevenue || 0} icon={<DollarOutlined />} color="#1677ff" formatter={formatMoney} onClick={clickable('/finance')} />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="未收金额" value={stats?.unpaidAmount || 0} icon={<DollarOutlined />} color="#faad14" formatter={formatMoney} onClick={clickable('/finance')} />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="合同总数" value={stats?.contractCount || 0} icon={<FileProtectOutlined />} color="#2f54eb" onClick={clickable('/contracts')} />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="今日日程" value={stats?.todaySchedules || 0} suffix="项" icon={<CalendarOutlined />} color="#722ed1" onClick={clickable('/schedules')} />
        </Col>
      </Row>

      <SectionTitle>销售运营</SectionTitle>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="跟进记录" value={stats?.followUpCount || 0} icon={<MessageOutlined />} color="#597ef7" onClick={clickable('/follow-ups')} />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="公海客户" value={stats?.publicPoolCount || 0} icon={<TeamOutlined />} color="#9254de" onClick={clickable('/public-pool')} />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="库存预警" value={stats?.lowStockCount || 0} suffix="项" icon={<WarningOutlined />} color="#fa8c16" onClick={clickable('/stock')} />
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="dashboard-main-row">
        <Col xs={24} lg={16}>
          <Card
            className="dashboard-panel"
            title="最近工单"
            extra={clickable('/work-orders', '/work-order-query', '/install-register') && (
              <Button type="link" size="small" onClick={clickable('/work-orders', '/work-order-query', '/install-register')}>查看全部</Button>
            )}
          >
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={recentOrders}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工单" /> }}
              columns={[
                { title: '工单号', dataIndex: 'orderNo', width: 150 },
                { title: '客户', dataIndex: 'customerName', ellipsis: true },
                { title: '销售', dataIndex: 'salesName', width: 72 },
                { title: '状态', dataIndex: 'status', width: 88, render: (s) => <OrderStatusTag status={s} /> },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="dashboard-panel dashboard-panel--todo" title="待办提醒">
            <div className="dashboard-todo-list">
              {todoItems.map((item) => (
                <div
                  key={item.title}
                  className={[
                    'dashboard-todo-item',
                    item.count > 0 && 'dashboard-todo-item--active',
                    !item.path && 'dashboard-todo-item--disabled',
                  ].filter(Boolean).join(' ')}
                  onClick={() => item.path && navigate(item.path)}
                >
                  <span className="dashboard-todo-item__dot" style={{ background: item.color }} />
                  <span className="dashboard-todo-item__title">{item.title}</span>
                  <span className="dashboard-todo-item__count" style={{ color: item.count > 0 ? item.color : '#999' }}>
                    {item.count}
                  </span>
                  {item.path ? (
                    <span className="dashboard-todo-item__action">去处理</span>
                  ) : (
                    <RightOutlined className="dashboard-todo-item__arrow" />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <DashboardCharts monthlyTrends={stats?.monthlyTrends} />
    </div>
  )
}
