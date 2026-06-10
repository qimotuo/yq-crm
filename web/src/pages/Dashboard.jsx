import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, List, Badge, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, TeamOutlined, DollarOutlined, CalendarOutlined, FileProtectOutlined, MessageOutlined } from '@ant-design/icons'
import { getDashboardStats } from '../api'
import { getWorkOrders } from '../api/workOrder'
import { OrderStatusTag } from '../components/StatusTag'
import { formatMoney } from '../utils/helpers'
import { APP_NAME } from '../constants/app'
import { DashboardCharts } from '../components/SimpleChart'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    getDashboardStats().then(setStats)
    getWorkOrders({}).then((res) => setRecentOrders(res.list.slice(0, 5)))
  }, [])

  const todoItems = [
    { title: '待派工单', count: stats?.pendingDispatch || 0, color: '#1677ff', path: '/dispatch' },
    { title: '安装中', count: stats?.installing || 0, color: '#faad14', path: '/install-register' },
    { title: '今日日程', count: stats?.todaySchedules || 0, color: '#722ed1', path: '/schedules' },
    { title: '公海客户', count: stats?.publicPoolCount || 0, color: '#9254de', path: '/public-pool' },
    { title: '回款逾期', count: stats?.overdueCount || 0, color: '#ff4d4f', path: '/finance' },
    { title: '库存预警', count: stats?.lowStockCount || 0, color: '#fa8c16', path: '/stock' },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>工作台</h2>
        <p>{APP_NAME} 数据概览</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}><Card className="stat-card"><Statistic title="工单总数" value={stats?.totalOrders || 0} prefix={<FileTextOutlined />} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="stat-card"><Statistic title="待派工" value={stats?.pendingDispatch || 0} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="stat-card"><Statistic title="已完成" value={stats?.completed || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="stat-card"><Statistic title="客户总数" value={stats?.totalCustomers || 0} prefix={<TeamOutlined />} /></Card></Col>
        <Col xs={24} sm={12} lg={8}><Card className="stat-card"><Statistic title="本月应收" value={stats?.monthlyRevenue || 0} prefix={<DollarOutlined />} formatter={formatMoney} /></Card></Col>
        <Col xs={24} sm={12} lg={8}><Card className="stat-card"><Statistic title="未收金额" value={stats?.unpaidAmount || 0} prefix={<DollarOutlined />} valueStyle={{ color: '#faad14' }} formatter={formatMoney} /></Card></Col>
        <Col xs={24} sm={12} lg={8}><Card className="stat-card"><Statistic title="今日日程" value={stats?.todaySchedules || 0} prefix={<CalendarOutlined />} valueStyle={{ color: '#722ed1' }} suffix="项" /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="stat-card"><Statistic title="合同总数" value={stats?.contractCount || 0} prefix={<FileProtectOutlined />} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="stat-card"><Statistic title="跟进记录" value={stats?.followUpCount || 0} prefix={<MessageOutlined />} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="stat-card"><Statistic title="公海客户" value={stats?.publicPoolCount || 0} prefix={<TeamOutlined />} valueStyle={{ color: '#9254de' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card className="stat-card"><Statistic title="库存预警" value={stats?.lowStockCount || 0} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#fa8c16' }} suffix="项" /></Card></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="最近工单" extra={<Button type="link" onClick={() => navigate('/work-orders')}>查看全部</Button>}>
            <Table size="small" pagination={false} rowKey="id" dataSource={recentOrders}
              columns={[
                { title: '工单号', dataIndex: 'orderNo', width: 160 },
                { title: '客户', dataIndex: 'customerName', ellipsis: true },
                { title: '销售', dataIndex: 'salesName', width: 70 },
                { title: '状态', dataIndex: 'status', width: 90, render: (s) => <OrderStatusTag status={s} /> },
              ]} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="待办提醒">
            <List dataSource={todoItems} renderItem={(item) => (
              <List.Item actions={[<Button key="action" type="link" size="small" onClick={() => navigate(item.path)}>处理</Button>]}>
                <Badge color={item.color} text={item.title} />
                <Tag>{item.count}</Tag>
              </List.Item>
            )} />
          </Card>
        </Col>
      </Row>

      <DashboardCharts monthlyTrends={stats?.monthlyTrends} />
    </div>
  )
}
