import { useEffect, useState } from 'react'
import { Table, Tag, Button, Modal, Form, Input, Select, message, Popconfirm, Switch, Space } from 'antd'
import { PlusOutlined, EditOutlined, KeyOutlined, DeleteOutlined } from '@ant-design/icons'
import { getSystemUsers, createSystemUser, updateSystemUser, deleteSystemUser, resetUserPassword, toggleUserEnabled, getRoles } from '../api'
import ExportButton from '../components/ExportButton'
import { Permission } from '../components/RequireAuth'
import { ROLE_COLORS } from '../rbac/config'
import { closeFormModal } from '../utils/formModal'
import { ListToolbar, FilterInput, FilterSelect, QueryButton, ResetButton, applyFilterPatch } from '../components/ListToolbar'

const EMPTY_FILTERS = { keyword: '', role: '', enabled: '' }

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
  const [roles, setRoles] = useState([])
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [query, setQuery] = useState({ ...EMPTY_FILTERS })
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
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
  }, [])

  const handleSearch = () => setQuery({ ...filters })

  const handleReset = () => {
    setFilters({ ...EMPTY_FILTERS })
    setQuery({ ...EMPTY_FILTERS })
  }

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const onSelectFilter = (key) => (v) => applyFilterPatch({ [key]: v || '' }, setFilters, setQuery)

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const closeModal = () => closeFormModal(form, setModalOpen, () => setEditing(null))

  const handleSave = async () => {
    const values = await form.validateFields()
    if (editing) {
      await updateSystemUser({ id: editing.id, ...values })
      message.success('用户已更新')
    } else {
      await createSystemUser(values)
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

  const roleOptions = roles.map((r) => ({ value: r.code, label: r.name }))

  const columns = [
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '角色', dataIndex: 'role', width: 120, render: (r) => {
      const role = roles.find((x) => x.code === r)
      return <Tag color={ROLE_COLORS[r]}>{role?.name || r}</Tag>
    }},
    { title: '状态', dataIndex: 'enabled', width: 90, render: (v, r) => (
      <Permission code="system:user:edit">
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
          <Permission code="system:user:edit">
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
              placeholder="用户名/姓名"
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
            <ExportButton filename="users.csv" />
          </>
        )}
      />

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ total, showTotal: (t) => `共 ${t} 条` }}
      />

      <Modal title={editing ? '编辑用户' : '新增用户'} open={modalOpen} onOk={handleSave} onCancel={closeModal} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
