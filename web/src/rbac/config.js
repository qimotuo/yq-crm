/** RBAC 权限配置 — 菜单 / 操作 / 数据权限 */

export const DATA_SCOPES = [
  { value: 'ALL', label: '全部数据', desc: '可查看系统所有数据' },
  { value: 'SELF', label: '仅本人', desc: '仅查看自己创建/负责的数据' },
  { value: 'ASSIGNED', label: '仅分配', desc: '仅查看分配给自己的工单' },
  { value: 'DEPT', label: '本部门', desc: '查看同部门用户负责的客户 / 工单 / 跟进 / 日程' },
]

/** 菜单树 — key 为路由 path 或分组 id */
export const MENU_TREE = [
  { key: '/dashboard', label: '工作台', group: '通用' },
  { key: '/ai-agent', label: '智脑中枢', group: '智能' },
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
      { key: '/install-register', label: '我的工单' },
      { key: '/work-order-query', label: '工单查询' },
    ],
  },
  {
    key: 'finance', label: '财务合同', group: '财务',
    children: [
      { key: '/customers', label: '合作客户' },
      { key: '/finance', label: '财务板块' },
      { key: '/account-ledger', label: '账户账本' },
      { key: '/admin-ledger', label: '行政账本' },
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
      { key: '/system/notifications', label: '消息通知' },
      { key: '/system/call-logs', label: '通话记录' },
      { key: '/system/cti-config', label: '电话条 CTI' },
      { key: '/system/print-template', label: '打印模板' },
      { key: '/system/logs', label: '操作日志' },
    ],
  },
]

/** 操作权限 — 按菜单拆开，查看 / 导入 / 导出各自独立 */
export const OPERATION_GROUPS = [
  {
    module: '公海客户',
    ops: [
      { code: 'public-pool:view', label: '查看' },
      { code: 'public-pool:create', label: '新增' },
      { code: 'public-pool:import', label: '导入' },
      { code: 'public-pool:export', label: '导出' },
      { code: 'public-pool:claim', label: '领取' },
    ],
  },
  {
    module: '公海池配置',
    ops: [
      { code: 'pool-config:view', label: '查看' },
      { code: 'pool-config:edit', label: '修改配置' },
      { code: 'pool-config:scan', label: '扫描退回' },
    ],
  },
  {
    module: '我的客户',
    ops: [
      { code: 'my-customer:view', label: '查看' },
      { code: 'my-customer:create', label: '新增' },
      { code: 'my-customer:edit', label: '编辑' },
      { code: 'my-customer:import', label: '导入' },
      { code: 'my-customer:export', label: '导出' },
      { code: 'my-customer:return', label: '退回公海' },
      { code: 'my-customer:follow', label: '跟进' },
      { code: 'my-customer:call', label: '外呼' },
      { code: 'my-customer:wechat', label: '微信' },
      { code: 'my-customer:workorder', label: '建工单' },
    ],
  },
  {
    module: '联系人',
    ops: [
      { code: 'contact:view', label: '查看' },
      { code: 'contact:create', label: '新增' },
      { code: 'contact:edit', label: '编辑' },
      { code: 'contact:import', label: '导入' },
      { code: 'contact:export', label: '导出' },
      { code: 'contact:call', label: '外呼' },
    ],
  },
  {
    module: '跟进记录',
    ops: [
      { code: 'follow:view', label: '查看' },
      { code: 'follow:create', label: '新增' },
      { code: 'follow:export', label: '导出' },
    ],
  },
  {
    module: '日程管理',
    ops: [
      { code: 'schedule:view', label: '查看' },
      { code: 'schedule:create', label: '新增' },
      { code: 'schedule:edit', label: '完成' },
      { code: 'schedule:export', label: '导出' },
    ],
  },
  {
    module: '销售派单',
    ops: [
      { code: 'workorder:view', label: '查看' },
      { code: 'workorder:create', label: '创建' },
      { code: 'workorder:edit', label: '编辑' },
      { code: 'workorder:delete', label: '删除' },
      { code: 'workorder:print', label: '打印' },
      { code: 'workorder:export', label: '导出' },
    ],
  },
  {
    module: '派工管理',
    ops: [
      { code: 'dispatch:view', label: '查看' },
      { code: 'dispatch:create', label: '新建工单' },
      { code: 'dispatch:edit', label: '编辑' },
      { code: 'dispatch:assign', label: '派工' },
      { code: 'dispatch:confirm', label: '确认完成' },
      { code: 'dispatch:print', label: '打印' },
      { code: 'dispatch:export', label: '导出' },
    ],
  },
  {
    module: '我的工单',
    ops: [
      { code: 'install:view', label: '查看' },
      { code: 'install:create', label: '新建工单' },
      { code: 'install:edit', label: '编辑' },
      { code: 'install:start', label: '开始安装' },
      { code: 'install:register', label: '安装登记' },
      { code: 'install:fail', label: '标记失败' },
      { code: 'install:export', label: '导出' },
    ],
  },
  {
    module: '工单查询',
    ops: [
      { code: 'workorder-query:view', label: '查看' },
      { code: 'workorder-query:create', label: '新建工单' },
      { code: 'workorder-query:edit', label: '编辑' },
      { code: 'workorder-query:export', label: '导出' },
    ],
  },
  {
    module: '设备出入库',
    ops: [
      { code: 'stock:view', label: '查看' },
      { code: 'stock:in', label: '设备入库' },
      { code: 'stock:in:edit', label: '编辑设备入库' },
      { code: 'stock:in:delete', label: '删除设备入库' },
      { code: 'stock:in:import', label: '导入设备入库' },
      { code: 'stock:in:export', label: '导出设备入库' },
      { code: 'stock:sim', label: 'SIM入库' },
      { code: 'stock:sim:edit', label: '编辑SIM入库' },
      { code: 'stock:sim:delete', label: '删除SIM入库' },
      { code: 'stock:sim:import', label: '导入SIM入库' },
      { code: 'stock:sim:export', label: '导出SIM入库' },
      { code: 'stock:out', label: '出库' },
      { code: 'stock:out:import', label: '导入出库' },
      { code: 'stock:out:export', label: '导出出库' },
      { code: 'stock:config', label: '预警阈值' },
    ],
  },
  {
    module: '合作客户',
    ops: [
      { code: 'customer:view', label: '查看' },
      { code: 'customer:create', label: '新增' },
      { code: 'customer:edit', label: '编辑' },
      { code: 'customer:delete', label: '删除' },
      { code: 'customer:import', label: '导入' },
      { code: 'customer:export', label: '导出' },
      { code: 'customer:payment', label: '录入回款' },
      { code: 'customer:payment-log', label: '回款记录' },
    ],
  },
  {
    module: '财务板块',
    ops: [
      { code: 'finance:view', label: '查看' },
      { code: 'finance:create', label: '新增' },
      { code: 'finance:edit', label: '编辑' },
      { code: 'finance:import', label: '导入' },
      { code: 'finance:export', label: '导出' },
      { code: 'finance:payment', label: '录入回款' },
      { code: 'finance:send', label: '发送对账单' },
    ],
  },
  {
    module: '账户账本',
    ops: [
      { code: 'account-ledger:view', label: '查看' },
      { code: 'account-ledger:create', label: '记账' },
      { code: 'account-ledger:delete', label: '删除' },
      { code: 'account-ledger:export', label: '导出' },
    ],
  },
  {
    module: '行政账本',
    ops: [
      { code: 'admin-ledger:view', label: '查看' },
      { code: 'admin-ledger:create', label: '记账' },
      { code: 'admin-ledger:delete', label: '删除' },
      { code: 'admin-ledger:import', label: '导入' },
      { code: 'admin-ledger:export', label: '导出' },
    ],
  },
  {
    module: '合同管理',
    ops: [
      { code: 'contract:view', label: '查看' },
      { code: 'contract:create', label: '新增' },
      { code: 'contract:edit', label: '编辑' },
      { code: 'contract:import', label: '导入' },
      { code: 'contract:export', label: '导出' },
      { code: 'contract:generate', label: '生成合同' },
      { code: 'contract:print', label: '打印' },
    ],
  },
  {
    module: '关联查询',
    ops: [
      { code: 'integrated:view', label: '查看' },
      { code: 'integrated:import', label: '导入' },
      { code: 'integrated:export', label: '导出' },
      { code: 'integrated:edit', label: '编辑' },
      { code: 'integrated:payment', label: '录入回款' },
      { code: 'integrated:send', label: '发送对账单' },
      { code: 'integrated:asset', label: '查看资产' },
    ],
  },
  {
    module: '全链路追溯',
    ops: [{ code: 'trace:view', label: '查看' }],
  },
  {
    module: '用户管理',
    ops: [
      { code: 'system:user:view', label: '查看' },
      { code: 'system:user:create', label: '新增' },
      { code: 'system:user:edit', label: '编辑' },
      { code: 'system:user:delete', label: '删除' },
      { code: 'system:user:reset', label: '重置密码' },
      { code: 'system:user:enable', label: '启用停用' },
      { code: 'system:user:import', label: '导入' },
      { code: 'system:user:export', label: '导出' },
    ],
  },
  {
    module: '角色权限',
    ops: [
      { code: 'system:role:view', label: '查看' },
      { code: 'system:role:edit', label: '配置权限' },
    ],
  },
  {
    module: '消息通知',
    ops: [
      { code: 'system:notify:view', label: '查看' },
      { code: 'system:notify:send', label: '发送' },
    ],
  },
  {
    module: '通话记录',
    ops: [
      { code: 'call-log:view', label: '查看' },
      { code: 'call-log:export', label: '导出' },
    ],
  },
  {
    module: '电话条 CTI',
    ops: [{ code: 'system:cti:config', label: '配置' }],
  },
  {
    module: '打印模板',
    ops: [{ code: 'system:print:config', label: '配置' }],
  },
  {
    module: '操作日志',
    ops: [
      { code: 'system:log:view', label: '查看' },
      { code: 'system:log:export', label: '导出' },
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
    menuKeys: ['/dashboard', '/ai-agent', '/public-pool', '/my-customers', '/contacts', '/follow-ups', '/schedules', '/work-orders', '/stock', '/customers', '/finance', '/contracts'],
    operations: ['public-pool:view', 'public-pool:create', 'public-pool:import', 'public-pool:claim', 'my-customer:view', 'my-customer:create', 'my-customer:edit', 'my-customer:import', 'my-customer:return', 'my-customer:follow', 'my-customer:call', 'my-customer:wechat', 'my-customer:workorder', 'contact:view', 'contact:create', 'contact:edit', 'contact:import', 'contact:call', 'follow:view', 'follow:create', 'schedule:view', 'schedule:create', 'schedule:edit', 'workorder:view', 'workorder:create', 'workorder:edit', 'workorder:delete', 'workorder:print', 'stock:view', 'stock:out', 'stock:out:import', 'stock:in:import', 'stock:sim:import', 'customer:view', 'customer:create', 'customer:edit', 'customer:delete', 'customer:import', 'customer:payment-log', 'finance:view', 'contract:view', 'contract:print', 'trace:view'],
    dataScope: 'SELF', enabled: true,
  },
  {
    id: 3, name: '安装人员', code: 'installer', userCount: 3,
    menuKeys: ['/dashboard', '/ai-agent', '/install-register', '/stock'],
    operations: ['install:view', 'install:start', 'install:register', 'install:fail', 'workorder:install', 'stock:view', 'stock:out', 'stock:out:import', 'stock:in:import', 'stock:sim:import', 'trace:view'],
    dataScope: 'ASSIGNED', enabled: true,
  },
  {
    id: 4, name: '财务', code: 'finance', userCount: 1,
    menuKeys: ['/dashboard', '/ai-agent', '/customers', '/finance', '/contracts', '/integrated', '/report-trace'],
    operations: ['customer:view', 'customer:payment', 'customer:payment-log', 'finance:view', 'finance:create', 'finance:edit', 'finance:import', 'finance:payment', 'finance:send', 'finance:export', 'integrated:view', 'integrated:import', 'integrated:export', 'integrated:edit', 'integrated:payment', 'integrated:send', 'integrated:asset', 'contract:view', 'contract:create', 'contract:edit', 'contract:import', 'contract:export', 'contract:generate', 'contract:print', 'trace:view'],
    dataScope: 'ALL', enabled: true,
  },
  {
    id: 5, name: '仓储管理员', code: 'warehouse', userCount: 1,
    menuKeys: ['/dashboard', '/ai-agent', '/stock'],
    operations: ['stock:view', 'stock:in', 'stock:in:edit', 'stock:in:delete', 'stock:in:import', 'stock:in:export', 'stock:sim', 'stock:sim:edit', 'stock:sim:delete', 'stock:sim:import', 'stock:sim:export', 'stock:out', 'stock:out:import', 'stock:out:export', 'stock:import', 'stock:export', 'stock:config'],
    dataScope: 'ALL', enabled: true,
  },
  {
    id: 6, name: '账户负责人', code: 'account_owner', userCount: 1,
    menuKeys: ['/dashboard', '/ai-agent', '/account-ledger'],
    operations: ['account-ledger:view', 'account-ledger:create', 'account-ledger:delete'],
    dataScope: 'ALL', enabled: true,
  },
  {
    id: 7, name: '行政', code: 'admin_staff', userCount: 1,
    menuKeys: ['/dashboard', '/ai-agent', '/admin-ledger'],
    operations: ['admin-ledger:view', 'admin-ledger:import'],
    dataScope: 'ALL', enabled: true,
  },
]

export const ROLE_COLORS = {
  admin: 'red', sales: 'blue', installer: 'green', finance: 'gold', warehouse: 'purple',
  account_owner: 'magenta', admin_staff: 'cyan',
}
