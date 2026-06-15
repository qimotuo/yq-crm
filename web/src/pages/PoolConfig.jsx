import { useEffect, useState } from 'react'
import { Card, Form, InputNumber, Input, Switch, Button, message, Descriptions, Tag, Table } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { getPoolConfig, updatePoolConfig, getReturnLogs } from '../api'

export default function PoolConfig() {
  const [loading, setLoading] = useState(false)
  const [logsLoading, setLogsLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [logs, setLogs] = useState([])
  const [form] = Form.useForm()

  const loadLogs = () => {
    setLogsLoading(true)
    getReturnLogs().then((res) => setLogs(res.list)).finally(() => setLogsLoading(false))
  }

  useEffect(() => {
    getPoolConfig().then((data) => { setConfig(data); form.setFieldsValue(data) })
    loadLogs()
  }, [form])

  const handleSave = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const data = await updatePoolConfig(values)
      setConfig(data)
      message.success('公海池策略已保存')
    } finally {
      setLoading(false)
    }
  }

  const logColumns = [
    { title: '退回时间', dataIndex: 'returnTime', width: 160 },
    { title: '客户名称', dataIndex: 'customerName', width: 180 },
    { title: '店名', dataIndex: 'storeName', width: 120 },
    { title: '原销售', dataIndex: 'salesName', width: 80 },
    { title: '原因', dataIndex: 'reason', render: (r) => <Tag>{r}</Tag> },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>公海池管理</h2>
        <p>配置公海池名称、客户自动退回策略，查看退回留痕</p>
      </div>

      <Card title="退回策略" style={{ maxWidth: 640, marginBottom: 24 }}>
        <Form form={form} layout="vertical">
          <Form.Item name="poolName" label="公海池名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="poolDescription" label="公海池描述">
            <Input.TextArea rows={2} placeholder="描述公海池用途、覆盖区域等" />
          </Form.Item>
          <Form.Item name="returnDays" label="未跟进自动退回天数" rules={[{ required: true }]}
            extra="超过该天数未跟进，客户自动退回公海池（定时任务每日扫描）">
            <InputNumber min={1} max={90} addonAfter="天" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="notifyBeforeReturn" label="退回前通知销售" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enabled" label="启用自动退回" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>保存配置</Button>
        </Form>
      </Card>

      {config && (
        <Card title="当前策略预览" style={{ maxWidth: 640, marginBottom: 24 }}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="公海池">{config.poolName}</Descriptions.Item>
            <Descriptions.Item label="描述">{config.poolDescription || '-'}</Descriptions.Item>
            <Descriptions.Item label="退回规则">
              {config.enabled ? <Tag color="blue">{config.returnDays} 天未跟进自动退回</Tag> : <Tag>已禁用</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="退回通知">{config.notifyBeforeReturn ? '开启' : '关闭'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card title="退回记录留痕">
        <Table columns={logColumns} dataSource={logs} rowKey="id" size="small" loading={logsLoading} pagination={{ pageSize: 8 }} />
      </Card>
    </div>
  )
}
