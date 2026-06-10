import { useEffect, useState } from 'react'
import { Table, Tag, Drawer, Button, Tabs, Tree, Checkbox, Radio, Space, message, Descriptions, Alert } from 'antd'
import { SafetyOutlined, EditOutlined } from '@ant-design/icons'
import { getRoles, updateRole } from '../api'
import { MENU_TREE, OPERATION_GROUPS, DATA_SCOPES, ROLE_COLORS, ALL_MENU_KEYS } from '../rbac/config'
import { Permission } from '../components/RequireAuth'

function buildMenuTreeData(nodes) {
  return nodes.map((n) => ({
    title: n.label,
    key: n.key,
    children: n.children ? buildMenuTreeData(n.children) : undefined,
    disableCheckbox: !n.key.startsWith('/'),
  }))
}

const menuTreeData = buildMenuTreeData(MENU_TREE)

function getLeafKeys(keys) {
  return keys.filter((k) => k.startsWith('/'))
}

export default function RoleList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [editing, setEditing] = useState(null)
  const [menuKeys, setMenuKeys] = useState([])
  const [operations, setOperations] = useState([])
  const [dataScope, setDataScope] = useState('SELF')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    getRoles().then((res) => setData(res.list)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openEdit = (role) => {
    setEditing(role)
    setMenuKeys(role.menuKeys?.includes('*') ? ALL_MENU_KEYS : [...(role.menuKeys || [])])
    setOperations(role.operations?.includes('*') ? OPERATION_GROUPS.flatMap((g) => g.ops.map((o) => o.code)) : [...(role.operations || [])])
    setDataScope(role.dataScope || 'SELF')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        id: editing.id,
        menuKeys: menuKeys.length === ALL_MENU_KEYS.length ? ALL_MENU_KEYS : getLeafKeys(menuKeys),
        operations,
        dataScope,
      }
      await updateRole(payload)
      message.success('权限已保存，相关用户需重新登录生效')
      setEditing(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { title: '角色名称', dataIndex: 'name', width: 120 },
    { title: '角色编码', dataIndex: 'code', width: 100, render: (c) => <Tag color={ROLE_COLORS[c]}>{c}</Tag> },
    { title: '用户数', dataIndex: 'userCount', width: 80 },
    { title: '菜单权限', dataIndex: 'menus', width: 120 },
    { title: '数据权限', dataIndex: 'dataScope', width: 100 },
    {
      title: '操作', width: 120,
      render: (_, r) => (
        <Permission code="system:role:edit">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} disabled={r.code === 'admin'}>
            配置权限
          </Button>
        </Permission>
      ),
    },
  ]

  const isAdmin = editing?.code === 'admin'

  return (
    <div>
      <div className="page-header">
        <h2>角色权限管理</h2>
        <p>菜单权限 + 操作权限 + 数据权限（RBAC）</p>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />

      <Drawer
        title={<><SafetyOutlined /> 配置权限 — {editing?.name}</>}
        open={!!editing}
        onClose={() => setEditing(null)}
        width={640}
        extra={<Button type="primary" loading={saving} onClick={handleSave}>保存</Button>}
      >
        {editing && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="角色编码">{editing.code}</Descriptions.Item>
              <Descriptions.Item label="当前用户">{editing.userCount} 人</Descriptions.Item>
            </Descriptions>
            {isAdmin && <Alert type="info" message="管理员拥有全部权限，不可修改" showIcon style={{ marginBottom: 16 }} />}
            <Tabs items={[
              {
                key: 'menu',
                label: '菜单权限',
                children: (
                  <Tree
                    checkable
                    defaultExpandAll
                    disabled={isAdmin}
                    treeData={menuTreeData}
                    checkedKeys={menuKeys}
                    onCheck={(keys) => setMenuKeys(Array.isArray(keys) ? keys : keys.checked)}
                  />
                ),
              },
              {
                key: 'ops',
                label: '操作权限',
                children: OPERATION_GROUPS.map((g) => (
                  <div key={g.module} style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{g.module}</div>
                    <Checkbox.Group
                      disabled={isAdmin}
                      value={operations}
                      onChange={setOperations}
                      options={g.ops.map((o) => ({ label: o.label, value: o.code }))}
                      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                    />
                  </div>
                )),
              },
              {
                key: 'data',
                label: '数据权限',
                children: (
                  <Radio.Group disabled={isAdmin} value={dataScope} onChange={(e) => setDataScope(e.target.value)}>
                    <Space direction="vertical">
                      {DATA_SCOPES.map((s) => (
                        <Radio key={s.value} value={s.value}>
                          <strong>{s.label}</strong>
                          <span style={{ color: '#999', marginLeft: 8 }}>{s.desc}</span>
                        </Radio>
                      ))}
                    </Space>
                  </Radio.Group>
                ),
              },
            ]} />
          </>
        )}
      </Drawer>
    </div>
  )
}
