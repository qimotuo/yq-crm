import { useEffect, useState } from 'react'
import { Card, Form, Input, Switch, Select, Button, message, Descriptions, Tag } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { getCtiConfig, updateCtiConfig } from '../api/cti'
import { Permission } from '../components/RequireAuth'

const MODE_OPTIONS = [
  { value: 'softphone', label: '软电话条（默认，通话落库）' },
  { value: 'tel', label: '系统拨号 tel: + 落库' },
  { value: 'webhook', label: '外呼平台 Webhook（后续接厂商）' },
]

export default function CtiConfig() {
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState(null)
  const [form] = Form.useForm()
  const mode = Form.useWatch('mode', form)

  useEffect(() => {
    getCtiConfig().then((data) => {
      setConfig(data)
      form.setFieldsValue(data)
    })
  }, [form])

  const handleSave = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const data = await updateCtiConfig(values)
      setConfig(data)
      message.success('CTI 配置已保存')
    } catch (e) {
      message.error(e.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>电话条 CTI</h2>
        <p>配置外呼模式；通话记录自动关联客户，Webhook 预留对接外呼平台</p>
      </div>

      <Card title="接入配置" style={{ maxWidth: 720, marginBottom: 24 }}>
        <Form form={form} layout="vertical">
          <Form.Item name="mode" label="外呼模式" rules={[{ required: true }]}>
            <Select options={MODE_OPTIONS} />
          </Form.Item>
          <Form.Item name="autoOpenTel" label="同时唤起系统拨号" valuePropName="checked"
            extra="软电话模式下也可勾选，便于本机耳机/手机联动">
            <Switch />
          </Form.Item>
          <Form.Item name="providerName" label="厂商名称">
            <Input placeholder="如：容联云 / 阿里云呼叫中心" />
          </Form.Item>
          <Form.Item name="webhookUrl" label="Webhook URL"
            extra={mode === 'webhook' ? '必填：外呼平台拨号接口' : 'webhook 模式时使用'}
            rules={mode === 'webhook' ? [{ required: true, message: '请填写 Webhook URL' }] : []}
          >
            <Input placeholder="https://cti.example.com/api/dial" />
          </Form.Item>
          <Form.Item name="webhookToken" label="Webhook Token">
            <Input.Password placeholder="Bearer Token（可选）" />
          </Form.Item>
          <Permission code="system:cti:config">
            <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>保存配置</Button>
          </Permission>
        </Form>
      </Card>

      {config && (
        <Card title="当前生效" style={{ maxWidth: 720 }}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="模式"><Tag color="blue">{config.mode}</Tag></Descriptions.Item>
            <Descriptions.Item label="系统拨号">{config.autoOpenTel || config.mode === 'tel' ? '开启' : '关闭'}</Descriptions.Item>
            <Descriptions.Item label="厂商">{config.providerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Webhook">{config.webhookUrl || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  )
}
