import { useEffect, useState } from 'react'
import { Card, Form, Input, Switch, Button, message, Divider } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { getServiceOrderPrintTemplate, updateServiceOrderPrintTemplate } from '../api/cti'
import { Permission } from '../components/RequireAuth'

const FIELD_SWITCHES = [
  ['showStatus', '显示状态'],
  ['showCustomer', '显示客户名称'],
  ['showStore', '显示店名'],
  ['showAddress', '显示安装地址'],
  ['showContact', '显示联系人'],
  ['showPhone', '显示联系电话'],
  ['showInstallDate', '显示预约日期'],
  ['showSales', '显示销售人员'],
  ['showInstaller', '显示安装人员'],
  ['showRemark', '显示安装备注'],
  ['showDevice', '显示设备信息区块'],
  ['showSignature', '显示签字栏'],
]

export default function PrintTemplateConfig() {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    getServiceOrderPrintTemplate().then((data) => form.setFieldsValue(data))
  }, [form])

  const handleSave = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      await updateServiceOrderPrintTemplate(values)
      message.success('打印模板已保存')
    } catch (e) {
      message.error(e.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>安装服务单打印模板</h2>
        <p>配置标题、展示字段与签字文案；派工/工单打印时即时生效</p>
      </div>

      <Card style={{ maxWidth: 760 }}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="单据标题" rules={[{ required: true }]}>
            <Input placeholder="基米网安装服务单" />
          </Form.Item>
          <Form.Item name="companyName" label="公司名称（副标题）">
            <Input placeholder="基米网" />
          </Form.Item>
          <Divider>字段显示</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            {FIELD_SWITCHES.map(([name, label]) => (
              <Form.Item key={name} name={name} label={label} valuePropName="checked">
                <Switch />
              </Form.Item>
            ))}
          </div>
          <Divider>签字栏文案</Divider>
          <Form.Item name="footerLeft" label="左侧">
            <Input />
          </Form.Item>
          <Form.Item name="footerCenter" label="中间">
            <Input />
          </Form.Item>
          <Form.Item name="footerRight" label="右侧">
            <Input />
          </Form.Item>
          <Form.Item name="extraNote" label="底部备注">
            <Input.TextArea rows={3} placeholder="如：本单仅作安装确认凭证，请妥善保管" />
          </Form.Item>
          <Permission code="system:print:config">
            <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>保存模板</Button>
          </Permission>
        </Form>
      </Card>
    </div>
  )
}
