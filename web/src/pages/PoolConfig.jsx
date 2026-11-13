import { useEffect, useState } from 'react'
import { Card, Form, InputNumber, Input, Switch, Button, message, Descriptions, Tag, Table, Space } from 'antd'
import { Permission } from '../components/RequireAuth'
import { SaveOutlined, SyncOutlined } from '@ant-design/icons'
import { getPoolConfig, updatePoolConfig, getReturnLogs, runPoolAutoReturn } from '../api'
import { useTablePagination } from '../hooks/useTablePagination'

export default function PoolConfig() {
  const [loading, setLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [logsLoading, setLogsLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [logs, setLogs] = useState([])
  const { pagination } = useTablePagination(10, logs.length)
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

  const handleScan = async () => {
    setScanLoading(true)
    try {
      const res = await runPoolAutoReturn()
      if (res.skipped) {
        message.warning(res.reason || '未执行扫描')
      } else {
        message.success(res.count ? `已自动退回 ${res.count} 条客户` : '扫描完成，暂无可退回客户')
      }
      loadLogs()
    } catch (e) {
      message.error(e.message || '扫描失败')
    } finally {
      setScanLoading(false)
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
            extra="超过该天数未跟进（无跟进记录则按领取时间），未成交私海客户将自动退回；服务启动后定时扫描">
            <InputNumber min={1} max={90} addonAfter="天" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="notifyBeforeReturn" label="退回前通知销售" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enabled" label="启用自动退回" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Permission code="pool-config:edit">
              <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>保存配置</Button>
            </Permission>
            <Permission code="pool-config:scan">
              <Button icon={<SyncOutlined />} loading={scanLoading} onClick={handleScan}>立即扫描退回</Button>
            </Permission>
          </Space>
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
        <Table columns={logColumns} dataSource={logs} rowKey="id" size="small" loading={logsLoading} pagination={pagination} />
      </Card>
    </div>
  )
}
