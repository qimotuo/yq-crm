import { useEffect, useState } from 'react'
import {
  Card, Form, Input, Select, Radio, Checkbox, Button, message, Table, Tag, Tabs, Alert, Tooltip,
} from 'antd'
import { SendOutlined, BellOutlined } from '@ant-design/icons'
import { getRoles, getSystemUsers } from '../api'
import {
  getNotifyTemplates, getNotifySendRecords, sendAdminNotification,
} from '../api/notify'
import { Permission } from '../components/RequireAuth'

const TARGET_LABELS = { all: '全部用户', roles: '按角色', users: '指定用户' }
const CHANNEL_LABELS = { site: '站内通知', miniprogram: '小程序订阅' }

export default function NotificationManage() {
  const [form] = Form.useForm()
  const [sending, setSending] = useState(false)
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [records, setRecords] = useState([])
  const [recordTotal, setRecordTotal] = useState(0)
  const [recordPage, setRecordPage] = useState(1)
  const [templates, setTemplates] = useState({ site: [], miniprogram: [] })
  const [targetType, setTargetType] = useState('roles')
  const targetTypeWatch = Form.useWatch('targetType', form)

  const loadRecords = (p = 1) => {
    getNotifySendRecords({ page: p, size: 10 }).then((res) => {
      setRecords(res.list)
      setRecordTotal(res.total)
      setRecordPage(res.page)
    })
  }

  useEffect(() => {
    getRoles().then((res) => setRoles(res.list))
    getSystemUsers().then((res) => setUsers(res.list.filter((u) => u.enabled !== false)))
    getNotifyTemplates().then(setTemplates)
    loadRecords()
    form.setFieldsValue({ targetType: 'roles', channels: ['site'], type: '系统' })
  }, [form])

  const applyTemplate = (code) => {
    const tpl = templates.site.find((t) => t.code === code)
    if (!tpl) return
    form.setFieldsValue({ title: tpl.title, content: tpl.content, path: tpl.path || '', type: tpl.type })
  }

  const handleSend = async () => {
    const values = await form.validateFields()
    if (!values.channels?.length) return message.warning('请至少选择一种通知渠道')
    setSending(true)
    try {
      const res = await sendAdminNotification(values)
      message.success(`已发送给 ${res.recipientCount} 位用户`)
      form.setFieldsValue({ title: '', content: '', path: '', roleCodes: undefined, userIds: undefined })
      loadRecords(1)
    } finally {
      setSending(false)
    }
  }

  const recordColumns = [
    { title: '发送时间', dataIndex: 'createdAt', width: 170 },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '接收范围',
      dataIndex: 'targetLabel',
      width: 160,
      render: (v, r) => (
        <Tooltip title={r.targetDetail}>
          <Tag>{TARGET_LABELS[r.targetType] || r.targetType}</Tag> {v}
        </Tooltip>
      ),
    },
    {
      title: '渠道',
      dataIndex: 'channels',
      width: 140,
      render: (chs) => chs.map((c) => <Tag key={c} color={c === 'site' ? 'blue' : 'green'}>{CHANNEL_LABELS[c]}</Tag>),
    },
    { title: '送达人数', dataIndex: 'recipientCount', width: 90 },
    { title: '发送人', dataIndex: 'senderName', width: 100 },
  ]

  const templateColumns = [
    { title: '模板编码', dataIndex: 'code', width: 180 },
    { title: '类型', dataIndex: 'type', width: 80, render: (t) => <Tag>{t}</Tag> },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '内容', dataIndex: 'content', ellipsis: true },
    {
      title: '渠道',
      dataIndex: 'channel',
      width: 100,
      render: (c) => <Tag color={c === 'site' ? 'blue' : 'green'}>{c === 'site' ? '站内' : '小程序'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 90,
      render: (v) => (v ? <Tag color="success">可用</Tag> : <Tag>预留</Tag>),
    },
  ]

  const sendForm = (
    <Card title="发送站内通知" style={{ maxWidth: 720 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="管理员可向全部用户、指定角色或指定用户发送提醒；小程序订阅消息渠道已预留，接入微信后可启用。"
      />
      <Form form={form} layout="vertical" onFinish={handleSend}>
        <Form.Item label="选用模板（可选）">
          <Select
            allowClear
            placeholder="选择模板自动填充标题与内容"
            options={templates.site.map((t) => ({ value: t.code, label: `${t.type} · ${t.title}` }))}
            onChange={applyTemplate}
          />
        </Form.Item>
        <Form.Item name="type" label="消息类型" rules={[{ required: true }]}>
          <Select options={['系统', '工单', '财务', '库存', '日程', '合同'].map((v) => ({ value: v, label: v }))} />
        </Form.Item>
        <Form.Item name="title" label="标题" rules={[{ required: true, max: 64 }]}>
          <Input placeholder="通知标题" maxLength={64} showCount />
        </Form.Item>
        <Form.Item name="content" label="内容" rules={[{ required: true, max: 200 }]}>
          <Input.TextArea rows={3} placeholder="通知正文" maxLength={200} showCount />
        </Form.Item>
        <Form.Item name="path" label="跳转链接（可选）" extra="用户点击通知后跳转的页面路径，如 /work-orders">
          <Input placeholder="/dashboard" />
        </Form.Item>
        <Form.Item name="targetType" label="接收对象" rules={[{ required: true }]}>
          <Radio.Group onChange={(e) => setTargetType(e.target.value)}>
            <Radio value="all">全部用户</Radio>
            <Radio value="roles">按角色</Radio>
            <Radio value="users">指定用户</Radio>
          </Radio.Group>
        </Form.Item>
        {(targetTypeWatch || targetType) === 'roles' && (
          <Form.Item name="roleCodes" label="目标角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              mode="multiple"
              placeholder="选择接收角色"
              options={roles.map((r) => ({ value: r.code, label: r.name }))}
            />
          </Form.Item>
        )}
        {(targetTypeWatch || targetType) === 'users' && (
          <Form.Item name="userIds" label="目标用户" rules={[{ required: true, message: '请选择用户' }]}>
            <Select
              mode="multiple"
              placeholder="选择接收用户"
              optionFilterProp="label"
              options={users.map((u) => ({
                value: u.id,
                label: `${u.name}（${u.username}）`,
              }))}
            />
          </Form.Item>
        )}
        <Form.Item name="channels" label="通知渠道" rules={[{ required: true }]}>
          <Checkbox.Group>
            <Checkbox value="site">站内通知</Checkbox>
            <Checkbox value="miniprogram" disabled>
              <Tooltip title="预留：接入微信小程序订阅消息后启用">小程序订阅消息</Tooltip>
            </Checkbox>
          </Checkbox.Group>
        </Form.Item>
        <Permission code="system:notify:send">
          <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={sending}>
            立即发送
          </Button>
        </Permission>
      </Form>
    </Card>
  )

  const allTemplates = [
    ...templates.site.map((t) => ({ ...t, channel: 'site', key: `s-${t.code}` })),
    ...templates.miniprogram.map((t) => ({ ...t, channel: 'miniprogram', key: `m-${t.code}` })),
  ]

  return (
    <div>
      <div className="page-header">
        <h2>消息通知</h2>
        <p>向指定角色或用户发送站内提醒，支持模板化消息与小程序订阅预留</p>
      </div>
      <Tabs
        items={[
          { key: 'send', label: <span><SendOutlined /> 发送通知</span>, children: sendForm },
          {
            key: 'records',
            label: <span><BellOutlined /> 发送记录</span>,
            children: (
              <Table
                rowKey="id"
                columns={recordColumns}
                dataSource={records}
                pagination={{ current: recordPage, total: recordTotal, pageSize: 10, onChange: loadRecords }}
              />
            ),
          },
          {
            key: 'templates',
            label: '消息模板',
            children: (
              <Table rowKey="key" columns={templateColumns} dataSource={allTemplates} pagination={false} />
            ),
          },
        ]}
      />
    </div>
  )
}
