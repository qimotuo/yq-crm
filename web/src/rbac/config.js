/** RBAC 权限配置 — 菜单 / 操作 / 数据权限 */

export const DATA_SCOPES = [
  { value: 'ALL', label: '全部数据', desc: '可查看系统所有数据' },
  { value: 'SELF', label: '仅本人', desc: '仅查看自己创建/负责的数据' },
  { value: 'ASSIGNED', label: '仅分配', desc: '仅查看分配给自己的工单' },
  { value: 'DEPT', label: '本部门', desc: '查看本部门数据（预留）' },
]

/** 菜单树 — key 为路由 path 或分组 id */
export const MENU_TREE = [
  { key: '/dashboard', label: '工作台', group: '通用' },
  {
    key: 'sales', label: '销售管理', group: '销售',
    children: [
      { key: '/public-pool', label: '公海客户' },
      { key: '/pool-config', label: '公海池配置' },
      { key: '/my-customers', label: '我的客户' },
      { key: '/contacts', label: '联系人' },
      { key: '/follow-ups', label: '跟进记录' },
      { key: '/schedules', label: '日程管理' },
      { key: '/work-orders', label: '销售派单' },
      { key: '/stock', label: '设备出入库' },
    ],
  },
  {
    key: 'install', label: '安装运维', group: '运维',
    children: [
      { key: '/dispatch', label: '派工管理' },
      { key: '/install-register', label: '安装登记' },
    ],
  },
  {
    key: 'finance', label: '财务合同', group: '财务',
    children: [
      { key: '/customers', label: '合作客户' },
      { key: '/finance', label: '财务板块' },
      { key: '/contracts', label: '合同管理' },
      { key: '/integrated', label: '关联查询' },
      { key: '/report-trace', label: '全链路追溯' },
    ],
  },
  {
    key: 'system', label: '系统管理', group: '系统',
    children: [
      { key: '/system/users', label: '用户管理' },
      { key: '/system/roles', label: '角色权限' },
    ],
  },
]

/** 操作权限 — 按模块分组 */
export const OPERATION_GROUPS = [
  {
    module: '系统管理',
    ops: [
      { code: 'system:user:view', label: '查看用户' },
      { code: 'system:user:create', label: '新增用户' },
      { code: 'system:user:edit', label: '编辑用户' },
      { code: 'system:user:delete', label: '删除用户' },
      { code: 'system:role:view', label: '查看角色' },
      { code: 'system:role:edit', label: '配置角色权限' },
    ],
  },
  {
    module: '客户管理',
    ops: [
      { code: 'customer:view', label: '查看客户' },
      { code: 'customer:create', label: '新增客户' },
      { code: 'customer:import', label: '导入客户' },
      { code: 'customer:claim', label: '领取公海' },
      { code: 'customer:return', label: '退回公海' },
      { code: 'customer:follow', label: '跟进记录' },
      { code: 'customer:call', label: '外呼' },
    ],
  },
  {
    module: '工单管理',
    ops: [
      { code: 'workorder:view', label: '查看工单' },
      { code: 'workorder:create', label: '创建工单' },
      { code: 'workorder:edit', label: '编辑工单' },
      { code: 'workorder:delete', label: '删除工单' },
      { code: 'workorder:dispatch', label: '派工' },
      { code: 'workorder:install', label: '安装登记' },
      { code: 'workorder:print', label: '打印服务单' },
    ],
  },
  {
    module: '财务模块',
    ops: [
      { code: 'finance:view', label: '查看财务' },
      { code: 'finance:payment', label: '录入回款' },
      { code: 'finance:send', label: '发送对账单' },
      { code: 'finance:export', label: '导出账单' },
    ],
  },
  {
    module: '仓储模块',
    ops: [
      { code: 'stock:view', label: '查看库存' },
      { code: 'stock:in', label: '入库' },
      { code: 'stock:out', label: '出库' },
      { code: 'stock:export', label: '导出' },
    ],
  },
]

export const ALL_OPERATIONS = OPERATION_GROUPS.flatMap((g) => g.ops.map((o) => o.code))

export const ALL_MENU_KEYS = (() => {
  const keys = []
  const walk = (nodes) => nodes.forEach((n) => {
    if (n.children) walk(n.children)
    else if (n.key.startsWith('/')) keys.push(n.key)
  })
  walk(MENU_TREE)
  return keys
})()

/** 预置角色 RBAC 配置 */
export const DEFAULT_ROLES = [
  {
    id: 1, name: '系统管理员', code: 'admin', userCount: 1,
    menuKeys: ['*'], operations: ['*'], dataScope: 'ALL', enabled: true,
  },
  {
    id: 2, name: '销售', code: 'sales', userCount: 3,
    menuKeys: ['/dashboard', '/public-pool', '/my-customers', '/contacts', '/follow-ups', '/schedules', '/work-orders', '/stock', '/customers'],
    operations: ['customer:view', 'customer:import', 'customer:claim', 'customer:return', 'customer:follow', 'customer:call', 'workorder:view', 'workorder:create', 'workorder:edit', 'workorder:delete', 'workorder:print', 'stock:view', 'stock:out'],
    dataScope: 'SELF', enabled: true,
  },
  {
    id: 3, name: '安装人员', code: 'installer', userCount: 3,
    menuKeys: ['/dashboard', '/dispatch', '/install-register', '/stock'],
    operations: ['workorder:view', 'workorder:install', 'stock:view'],
    dataScope: 'ASSIGNED', enabled: true,
  },
  {
    id: 4, name: '财务', code: 'finance', userCount: 1,
    menuKeys: ['/dashboard', '/customers', '/finance', '/contracts', '/integrated', '/report-trace'],
    operations: ['customer:view', 'finance:view', 'finance:payment', 'finance:send', 'finance:export'],
    dataScope: 'ALL', enabled: true,
  },
  {
    id: 5, name: '仓储管理员', code: 'warehouse', userCount: 1,
    menuKeys: ['/dashboard', '/stock'],
    operations: ['stock:view', 'stock:in', 'stock:out', 'stock:export'],
    dataScope: 'ALL', enabled: true,
  },
]

export const ROLE_COLORS = { admin: 'red', sales: 'blue', installer: 'green', finance: 'gold', warehouse: 'purple' }
