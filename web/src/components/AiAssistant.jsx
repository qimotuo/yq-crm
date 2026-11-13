import { useEffect } from 'react'
import { Badge, Button } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAgentContext } from '../context/AgentContext'

const PAGE_LABELS = {
  '/dashboard': '工作台',
  '/customers': '合作客户',
  '/my-customers': '我的客户',
  '/finance': '财务板块',
  '/work-orders': '销售派单',
  '/dispatch': '派工管理',
  '/install-register': '安装登记',
  '/report-trace': '全链路追溯',
}

export default function AiAssistant() {
  const navigate = useNavigate()
  const location = useLocation()
  const { context, mergeAgentContext } = useAgentContext()

  useEffect(() => {
    if (location.pathname === '/ai-agent') return
    mergeAgentContext({
      page: PAGE_LABELS[location.pathname] || location.pathname,
      path: location.pathname,
    })
  }, [location.pathname, mergeAgentContext])

  if (location.pathname === '/ai-agent') return null

  return (
    <div className="ai-assistant-fab">
      <Badge dot={Boolean(context.customerName)} color="#a855f7">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<RobotOutlined />}
          className="ai-assistant-fab__btn"
          title="打开智脑中枢"
          onClick={() => navigate('/ai-agent')}
        />
      </Badge>
    </div>
  )
}
