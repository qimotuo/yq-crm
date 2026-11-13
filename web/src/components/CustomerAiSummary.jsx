import { useEffect, useState } from 'react'
import { Alert, Button, Skeleton, Space, Tag, Typography } from 'antd'
import { BulbOutlined, ReloadOutlined, RobotOutlined, WarningOutlined } from '@ant-design/icons'
import { agentCustomerSummary } from '../api/agent'

const { Text, Paragraph } = Typography

export default function CustomerAiSummary({ customer, visible }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    if (!customer?.id) return
    setLoading(true)
    setError('')
    try {
      const res = await agentCustomerSummary(customer.id)
      setData(res)
    } catch (e) {
      setError(e.message || '摘要生成失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible && customer?.id) {
      load()
    }
  }, [visible, customer?.id])

  if (!customer) return null

  return (
    <div className="ai-summary-card">
      <div className="ai-summary-card__head">
        <Space>
          <RobotOutlined className="ai-summary-card__icon" />
          <Text strong>AI 智能摘要</Text>
          <Tag color="purple" bordered={false}>Demo</Tag>
        </Space>
        <Button type="text" size="small" icon={<ReloadOutlined />} loading={loading} onClick={load}>
          刷新
        </Button>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}

      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : data ? (
        <>
          <Paragraph className="ai-summary-card__lead">{data.summary}</Paragraph>

          {data.highlights?.length > 0 && (
            <div className="ai-summary-block">
              <Text type="secondary" className="ai-summary-block__label">要点</Text>
              <ul className="ai-summary-list">
                {data.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {data.risks?.length > 0 && (
            <div className="ai-summary-block ai-summary-block--risk">
              <Text type="danger" className="ai-summary-block__label"><WarningOutlined /> 风险</Text>
              <ul className="ai-summary-list">
                {data.risks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {data.actions?.length > 0 && (
            <div className="ai-summary-block ai-summary-block--action">
              <Text className="ai-summary-block__label"><BulbOutlined /> 建议行动</Text>
              <ul className="ai-summary-list">
                {data.actions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {data.sources?.length > 0 && (
            <div className="ai-summary-sources">
              依据：{data.sources.map((s) => (
                <Tag key={s} bordered={false}>{s}</Tag>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
