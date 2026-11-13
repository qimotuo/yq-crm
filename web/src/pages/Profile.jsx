import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Form, Input, Select, Button, Avatar, Tag, message, Modal, Upload, Space, Divider,
} from 'antd'
import { UserOutlined, LogoutOutlined, LockOutlined, CameraOutlined, SaveOutlined } from '@ant-design/icons'
import { useAuth } from '../hooks/useAuth'
import { DEFAULT_ROLES, ROLE_COLORS } from '../rbac/config'
import { getMe, updateProfile, changePassword } from '../api/auth'

const { TextArea } = Input

const GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'unknown', label: '保密' },
]

function genderLabel(value) {
  return GENDER_OPTIONS.find((o) => o.value === value)?.label || '未设置'
}

function UserAvatar({ src, size = 80 }) {
  return (
    <Avatar
      size={size}
      src={src || undefined}
      icon={!src ? <UserOutlined /> : undefined}
      style={!src ? { background: '#1677ff' } : undefined}
    />
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, logout, updateUser } = useAuth()
  const [form] = Form.useForm()
  const [pwdForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [avatar, setAvatar] = useState(user.avatar || '')

  const roleName = DEFAULT_ROLES.find((r) => r.code === user.role)?.name || user.role

  useEffect(() => {
    setLoading(true)
    getMe()
      .then((data) => {
        const u = data.user || data
        updateUser(u)
        form.setFieldsValue({
          name: u.name,
          nickname: u.nickname || '',
          phone: u.phone || '',
          email: u.email || '',
          gender: u.gender || undefined,
          description: u.description || '',
        })
        setAvatar(u.avatar || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAvatar = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      setAvatar(reader.result)
    }
    reader.readAsDataURL(file)
    return false
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const data = await updateProfile({ ...values, avatar })
      updateUser(data)
      message.success('资料已保存')
    } catch (e) {
      message.error(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    const values = await pwdForm.validateFields()
    setPwdSaving(true)
    try {
      await changePassword(values.oldPassword, values.newPassword)
      message.success('密码修改成功，请重新登录')
      setPwdOpen(false)
      pwdForm.resetFields()
      logout()
      navigate('/login')
    } catch (e) {
      message.error(e.message || '修改失败')
    } finally {
      setPwdSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>个人中心</h2>
        <p>管理个人资料与账号安全</p>
      </div>
      <Card style={{ maxWidth: 560 }} loading={loading}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Upload showUploadList={false} accept="image/*" beforeUpload={handleAvatar}>
            <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
              <UserAvatar src={avatar} />
              <div style={{
                position: 'absolute', right: 0, bottom: 0, background: '#1677ff',
                borderRadius: '50%', width: 28, height: 28, display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#fff', border: '2px solid #fff',
              }}>
                <CameraOutlined style={{ fontSize: 14 }} />
              </div>
            </div>
          </Upload>
          <h3 style={{ marginTop: 12, marginBottom: 4 }}>{user.nickname || user.name}</h3>
          {user.nickname && user.nickname !== user.name && (
            <div style={{ color: '#999', fontSize: 13 }}>{user.name}</div>
          )}
          <Space>
            <Tag color={ROLE_COLORS[user.role]}>{roleName}</Tag>
            <Tag color="success">正常</Tag>
          </Space>
          <div style={{ color: '#999', fontSize: 13, marginTop: 8 }}>@{user.username}</div>
        </div>

        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item label="真实姓名" name="name" rules={[{ required: true, message: '请输入真实姓名' }]}>
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item label="昵称" name="nickname">
            <Input placeholder="对外展示名称，选填" />
          </Form.Item>
          <Form.Item label="手机号" name="phone" rules={[{
            validator: (_, value) => {
              if (!value || /^1\d{10}$/.test(value)) return Promise.resolve()
              return Promise.reject(new Error('请输入有效手机号'))
            },
          }]}>
            <Input placeholder="11位手机号" maxLength={11} />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{
            validator: (_, value) => {
              if (!value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return Promise.resolve()
              return Promise.reject(new Error('请输入有效邮箱'))
            },
          }]}>
            <Input placeholder="name@example.com" />
          </Form.Item>
          <Form.Item label="性别" name="gender">
            <Select allowClear placeholder="请选择" options={GENDER_OPTIONS} />
          </Form.Item>
          <Form.Item label="备注" name="description">
            <TextArea rows={3} placeholder="备注信息" maxLength={200} showCount />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} block>
              保存资料
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Button icon={<LockOutlined />} block onClick={() => setPwdOpen(true)}>
            修改密码
          </Button>
          <Button danger icon={<LogoutOutlined />} block
            onClick={() => { logout(); navigate('/login') }}>
            退出登录
          </Button>
        </Space>
      </Card>

      <Modal
        title="修改密码"
        open={pwdOpen}
        onCancel={() => { setPwdOpen(false); pwdForm.resetFields() }}
        onOk={handleChangePassword}
        confirmLoading={pwdSaving}
        destroyOnHidden
      >
        <Form form={pwdForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="newPassword" label="新密码" rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码至少 6 位' },
          ]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认新密码" dependencies={['newPassword']} rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                return Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export { UserAvatar, genderLabel }
