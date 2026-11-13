import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, message, Popconfirm, Switch, Space, Upload } from 'antd'
import { PlusOutlined, EditOutlined, KeyOutlined, DeleteOutlined, CameraOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { getSystemUsers, createSystemUser, updateSystemUser, deleteSystemUser, resetUserPassword, toggleUserEnabled, getRoles, importSystemUsers } from '../api'
import { getDepartments } from '../api/rbac'
import ExportButton from '../components/ExportButton'
import { Permission } from '../components/RequireAuth'
import { ROLE_COLORS } from '../rbac/config'
import { closeFormModal } from '../utils/formModal'
import { downloadCsvTemplate, parseImportFile, IMPORT_ACCEPT } from '../utils/csvImport'
import { ListToolbar, FilterInput, FilterSelect, QueryButton, ResetButton, applyFilterPatch } from '../components/ListToolbar'
import FormColumnLayout, { modalFormWidth } from '../components/FormColumnLayout'
import { UserAvatar, genderLabel } from './Profile'
import { useTablePagination } from '../hooks/useTablePagination'

const { TextArea } = Input

const EMPTY_FILTERS = { keyword: '', role: '', enabled: '' }

const GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'unknown', label: '保密' },
]

const USER_IMPORT_TEMPLATE = {
  filename: '用户导入模板.csv',
  headers: ['账号', '真实姓名', '昵称', '角色编码', '部门编码', '手机号', '邮箱', '性别', '备注'],
  keys: ['username', 'name', 'nickname', 'role', 'deptCode', 'phone', 'email', 'gender', 'description'],
  sample: ['wangwu', '王五', '五哥', 'sales', 'sales', '13900139001', 'wangwu@example.com', '男', '华东销售'],
  required: ['username', 'name', 'role'],
}

function buildQueryParams(query) {
  const params = {}
  Object.entries(query).forEach(([key, value]) => {
    if (value) params[key] = value
  })
  return params
}

export default function SystemUserList() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const { pagination } = useTablePagination(10, data.length)
  const [roles, setRoles] = useState([])
  const [departments, setDepartments] = useState([])
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [query, setQuery] = useState({ ...EMPTY_FILTERS })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [avatar, setAvatar] = useState('')
  const [form] = Form.useForm()

  const load = async (params = query) => {
    setLoading(true)
    try {
      const res = await getSystemUsers(buildQueryParams(params))
      setData(res.list)
      setTotal(res.total ?? res.list.length)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [query])

  useEffect(() => {
    getRoles().then((res) => setRoles(res.list))
    getDepartments().then((res) => setDepartments(res.list || [])).catch(() => setDepartments([]))
  }, [])

  const deptName = (code) => departments.find((d) => d.code === code)?.name || code || '—'
  const roleOptions = roles.map((r) => ({ value: r.code, label: r.name }))
  const deptOptions = departments.map((d) => ({ value: d.code, label: d.name }))

  const handleSearch = () => setQuery({ ...filters })

  const handleReset = () => {
    setFilters({ ...EMPTY_FILTERS })
    setQuery({ ...EMPTY_FILTERS })
  }

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const onSelectFilter = (key) => (v) => applyFilterPatch({ [key]: v || '' }, setFilters, setQuery)

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    setModalOpen(true)
  }

  useEffect(() => {
    if (!modalOpen) return
    if (editing) {
      setAvatar(editing.avatar || '')
      form.setFieldsValue({
        username: editing.username,
        name: editing.name,
        nickname: editing.nickname || '',
        phone: editing.phone || '',
        email: editing.email || '',
        gender: editing.gender || undefined,
        description: editing.description || '',
        role: editing.role,
        deptCode: editing.deptCode || undefined,
      })
    } else {
      setAvatar('')
      form.resetFields()
      form.setFieldsValue({
        role: roles[0]?.code || 'sales',
        deptCode: departments[0]?.code,
      })
    }
  }, [modalOpen, editing, form, roles, departments])

  const closeModal = () => {
    setAvatar('')
    closeFormModal(form, setModalOpen, () => setEditing(null))
  }

  const handleAvatar = (file) => {
    const reader = new FileReader()
    reader.onload = () => setAvatar(reader.result)
    reader.readAsDataURL(file)
    return false
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    const payload = { ...values, avatar }
    if (editing) {
      await updateSystemUser({ id: editing.id, ...payload })
      message.success('用户已更新')
    } else {
      await createSystemUser(payload)
      message.success('用户已创建，默认密码 123456')
    }
    closeModal()
    load()
  }

  const handleResetPwd = async (id) => {
    await resetUserPassword(id)
    message.success('密码已重置为 123456')
  }

  const handleToggle = async (record, enabled) => {
    await toggleUserEnabled(record.id, enabled)
    message.success(enabled ? '已启用' : '已禁用')
    load()
  }

  const handleDelete = async (id) => {
    try {
      await deleteSystemUser(id)
      message.success('已删除')
      load()
    } catch (e) {
      message.error(e.message)
    }
  }

  const handleImport = async (file) => {
    try {
      const rows = await parseImportFile(file, USER_IMPORT_TEMPLATE)
      const res = await importSystemUsers(rows)
      const skippedTip = res.skipped ? `，跳过重复 ${res.skipped} 条` : ''
      message.success(`成功导入 ${res.count} 条用户${skippedTip}，默认密码 123456`)
      load()
    } catch (e) {
      message.error(e.message || '导入失败')
    }
    return false
  }

  const columns = [
    { title: '工号', dataIndex: 'id', width: 72, fixed: 'left' },
    { title: '头像', dataIndex: 'avatar', width: 64, render: (v) => <UserAvatar src={v} size={36} /> },
    { title: '账号', dataIndex: 'username', width: 110 },
    { title: '真实姓名', dataIndex: 'name', width: 100 },
    { title: '昵称', dataIndex: 'nickname', width: 100, render: (v) => v || '-' },
    { title: '手机号', dataIndex: 'phone', width: 120, render: (v) => v || '-' },
    { title: '邮箱', dataIndex: 'email', width: 160, ellipsis: true, render: (v) => v || '-' },
    { title: '性别', dataIndex: 'gender', width: 70, render: (v) => (v ? genderLabel(v) : '-') },
    { title: '备注', dataIndex: 'description', width: 140, ellipsis: true, render: (v) => v || '-' },
    { title: '角色', dataIndex: 'role', width: 110, render: (r) => {
      const role = roles.find((x) => x.code === r)
      return <Tag color={ROLE_COLORS[r]}>{role?.name || r}</Tag>
    }},
    { title: '部门', dataIndex: 'deptCode', width: 100, render: (v) => deptName(v) },
    { title: '状态', dataIndex: 'enabled', width: 90, render: (v, r) => (
      <Permission code="system:user:enable">
        <Switch checked={v !== false} size="small" disabled={r.role === 'admin'} onChange={(checked) => handleToggle(r, checked)} />
      </Permission>
    )},
    {
      title: '操作', width: 220,
      render: (_, r) => (
        <Space size="small">
          <Permission code="system:user:edit">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          </Permission>
          <Permission code="system:user:reset">
            <Popconfirm title="重置密码为 123456？" onConfirm={() => handleResetPwd(r.id)}>
              <Button type="link" size="small" icon={<KeyOutlined />}>重置密码</Button>
            </Popconfirm>
          </Permission>
          <Permission code="system:user:delete">
            {r.role !== 'admin' && (
              <Popconfirm title="确认删除该用户？" onConfirm={() => handleDelete(r.id)}>
                <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            )}
          </Permission>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>用户管理</h2>
        <p>系统用户与角色分配</p>
      </div>

      <ListToolbar
        filters={(
          <>
            <FilterInput
              placeholder="账号/姓名/昵称/手机/邮箱"
              value={filters.keyword}
              onChange={(e) => setFilter('keyword', e.target.value)}
              onPressEnter={handleSearch}
            />
            <FilterSelect
              placeholder="角色"
              value={filters.role || undefined}
              onChange={onSelectFilter('role')}
              options={roleOptions}
            />
            <FilterSelect
              placeholder="状态"
              value={filters.enabled || undefined}
              onChange={onSelectFilter('enabled')}
              options={[
                { value: 'true', label: '启用' },
                { value: 'false', label: '禁用' },
              ]}
            />
            <QueryButton loading={loading} onClick={handleSearch} />
            <ResetButton onClick={handleReset} />
          </>
        )}
        actions={(
          <>
            <Permission code="system:user:create">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增用户</Button>
            </Permission>
            <Permission code="system:user:import">
              <Button icon={<DownloadOutlined />} onClick={() => downloadCsvTemplate(USER_IMPORT_TEMPLATE)}>
                下载模板
              </Button>
            </Permission>
            <Permission code="system:user:import">
              <Upload accept={IMPORT_ACCEPT} showUploadList={false} beforeUpload={handleImport}>
                <Button icon={<UploadOutlined />}>批量导入</Button>
              </Upload>
            </Permission>
            <Permission code="system:user:export">
              <ExportButton filename="users.csv" data={data} columns={columns} />
            </Permission>
          </>
        )}
      />

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1380 }}
        pagination={{ ...pagination, total, showTotal: (t) => `共 ${t} 条` }}
      />

      <Modal
        title={editing ? '编辑用户' : '新增用户'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={closeModal}
        destroyOnHidden
        width={modalFormWidth(8)}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Upload showUploadList={false} accept="image/*" beforeUpload={handleAvatar}>
              <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
                <UserAvatar src={avatar} size={64} />
                <div style={{
                  position: 'absolute', right: 0, bottom: 0, background: '#1677ff',
                  borderRadius: '50%', width: 22, height: 22, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: '#fff', border: '2px solid #fff',
                }}>
                  <CameraOutlined style={{ fontSize: 12 }} />
                </div>
              </div>
            </Upload>
          </div>
          <FormColumnLayout threshold={1}>
            <Form.Item name="username" label="账号" rules={[{ required: true }]}>
              <Input disabled={!!editing} />
            </Form.Item>
            <Form.Item name="name" label="真实姓名" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="nickname" label="昵称">
              <Input placeholder="对外展示名称，选填" />
            </Form.Item>
            <Form.Item name="phone" label="手机号" rules={[{
              validator: (_, value) => {
                if (!value || /^1\d{10}$/.test(value)) return Promise.resolve()
                return Promise.reject(new Error('请输入有效手机号'))
              },
            }]}>
              <Input maxLength={11} />
            </Form.Item>
            <Form.Item name="email" label="邮箱" rules={[{
              validator: (_, value) => {
                if (!value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return Promise.resolve()
                return Promise.reject(new Error('请输入有效邮箱'))
              },
            }]}>
              <Input />
            </Form.Item>
            <Form.Item name="gender" label="性别">
              <Select allowClear placeholder="请选择" options={GENDER_OPTIONS} />
            </Form.Item>
            <Form.Item name="role" label="角色" rules={[{ required: true }]}>
              <Select options={roleOptions} />
            </Form.Item>
            <Form.Item name="deptCode" label="部门">
              <Select allowClear placeholder="未分配" options={deptOptions} />
            </Form.Item>
            <Form.Item name="description" label="备注">
              <TextArea rows={2} maxLength={200} showCount placeholder="备注信息" />
            </Form.Item>
          </FormColumnLayout>
        </Form>
      </Modal>
    </div>
  )
}
