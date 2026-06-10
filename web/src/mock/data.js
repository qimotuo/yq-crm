// 未迁移后端的业务模块 Mock 数据

export const customers = [
  {
    id: 1,
    storeName: '红渡小香',
    customerName: '智慧社区A区物业',
    contact: '小王',
    phone: '13800138000',
    orderNo: 'GD-20261025-088',
    installDate: '2026-10-27',
    deviceSupplier: '鲲鹏',
    deviceModel: '618',
    mac: 'AA:BB:CC:DD:EE:01',
    imei: '865432041234567',
    simSupplier: '光和',
    operator: '移动',
    iccid: '89860123456789012345',
    contractPeriod: '2026-01-01 至 2027-01-01',
    invoiceType: '增值税专用发票',
    salesName: '张三',
    contactStatus: '正常',
  },
  {
    id: 2,
    storeName: '厚贞日式烤肉',
    customerName: '滨江工业园管委会',
    contact: '陈经理',
    phone: '13900139000',
    orderNo: 'GD-20261026-092',
    installDate: '',
    deviceSupplier: '',
    deviceModel: '',
    mac: '',
    imei: '',
    simSupplier: '',
    operator: '',
    iccid: '',
    contractPeriod: '2026-11-06 至 2027-11-05',
    invoiceType: '增值税普通发票',
    salesName: '李四',
    contactStatus: '正常',
  },
  {
    id: 3,
    storeName: '必三咖啡',
    customerName: '连锁便利店总部',
    contact: '刘店长',
    phone: '13700137000',
    orderNo: 'GD-20261027-105',
    installDate: '',
    deviceSupplier: '',
    deviceModel: '',
    mac: '',
    imei: '',
    simSupplier: '',
    operator: '移动',
    iccid: '',
    contractPeriod: '2026-11-15 至 2027-11-14',
    invoiceType: '不开发票',
    salesName: '王五',
    contactStatus: '中断合作',
  },
  {
    id: 4,
    storeName: '稻状元',
    customerName: '科技初创公司B',
    contact: '周总',
    phone: '13600136000',
    orderNo: 'GD-20260101-001',
    installDate: '',
    deviceSupplier: '',
    deviceModel: '',
    mac: '',
    imei: '',
    simSupplier: '',
    operator: '移动(6),电信(4)',
    iccid: '',
    contractPeriod: '2026-11-16 至 2027-11-15',
    invoiceType: '待开票',
    salesName: '赵六',
    contactStatus: '正常',
  },
]

export const financeList = [
  {
    id: 1,
    storeName: '红渡小香',
    customerName: '智慧社区A区物业',
    orderNo: 'GD-20261025-088',
    package: '企业旗舰版 (5账号)',
    billMonth: '2026-11',
    contractPeriod: '2026-11-02 至 2027-11-01',
    contractStatus: '正常',
    totalAmount: 12000,
    paidAmount: 12000,
    unpaidAmount: 0,
    paymentStatus: '已回款',
    paymentProgress: 100,
    invoiceStatus: '已开票',
    salesName: '张三',
    paymentPlanDate: '2026-11-05',
  },
  {
    id: 2,
    storeName: '厚贞日式烤肉',
    customerName: '滨江工业园管委会',
    orderNo: 'GD-20261026-092',
    package: '标准版 (2账号)',
    billMonth: '2026-11',
    contractPeriod: '2026-11-06 至 2027-11-05',
    contractStatus: '即将到期',
    totalAmount: 5000,
    paidAmount: 2500,
    unpaidAmount: 2500,
    paymentStatus: '部分回款',
    paymentProgress: 50,
    invoiceStatus: '待开票',
    salesName: '李四',
    paymentPlanDate: '2026-11-05',
  },
  {
    id: 3,
    storeName: '必三咖啡',
    customerName: '连锁便利店总部',
    orderNo: 'GD-20261027-105',
    package: '基础版 (1账号)',
    billMonth: '2026-11',
    contractPeriod: '2026-11-15 至 2027-11-14',
    contractStatus: '正常',
    totalAmount: 2000,
    paidAmount: 0,
    unpaidAmount: 2000,
    paymentStatus: '已逾期',
    paymentProgress: 0,
    invoiceStatus: '不开票',
    salesName: '王五',
    paymentPlanDate: '2026-11-06',
  },
  {
    id: 4,
    storeName: '稻状元',
    customerName: '科技初创公司B',
    orderNo: 'GD-20260101-001',
    package: '企业旗舰版 (10账号)',
    billMonth: '2026-11',
    contractPeriod: '2026-11-16 至 2027-11-15',
    contractStatus: '正常',
    totalAmount: 25000,
    paidAmount: 0,
    unpaidAmount: 25000,
    paymentStatus: '未回款',
    paymentProgress: 0,
    invoiceStatus: '待开票',
    salesName: '赵六',
    paymentPlanDate: '2026-11-07',
  },
]

export const stockInList = [
  { id: 1, inNo: 'RK20261027001', inDate: '2026-10-27', supplier: '鲲鹏', model: '鲲鹏618', imei: '865432041234567', mac: 'AA:BB:CC:DD:EE:01', qty: 10, stockQty: 12, receiver: '张三', remark: '首批试点安装' },
  { id: 2, inNo: 'RK20261027002', inDate: '2026-10-27', supplier: '云软', model: '华为', imei: '865432041234568', mac: 'AA:BB:CC:DD:EE:02', qty: 20, stockQty: 21, receiver: '李四', remark: '需配合弱电施工' },
  { id: 3, inNo: 'RK20261027003', inDate: '2026-10-28', supplier: '云软', model: '中兴', imei: '865432041234569', mac: 'AA:BB:CC:DD:EE:03', qty: 10, stockQty: 11, receiver: '王五', remark: '替换故障旧机' },
]

export const stockOutList = [
  { id: 1, outNo: 'CK20261027001', outDate: '2026-10-27', orderNo: 'GD-20261025-088', storeName: '红渡小香', customerName: '智慧社区A区物业', address: 'A区3栋1单元门禁处', model: '鲲鹏618', imei: '865432041234567', mac: 'AA:BB:CC:DD:EE:01', iccid: '89860123456789012345', operator: '中国移动', receiver: '张三', remark: '首批试点安装' },
  { id: 2, outNo: 'CK20261027002', outDate: '2026-10-27', orderNo: 'GD-20261026-092', storeName: '厚贞日式烤肉', customerName: '滨江工业园管委会', address: 'B座5层会议室监控点', model: '华为', imei: '865432041234568', mac: 'AA:BB:CC:DD:EE:02', iccid: '89860323456789012346', operator: '中国电信', receiver: '李四', remark: '需配合弱电施工' },
]

export const simStockInList = [
  { id: 1, inNo: 'RK20261027004', inDate: '2026-10-27', supplier: '鲲鹏', operator: '中国移动', iccid: '89860123456789012345', qty: 10, stockQty: 12, receiver: '张三', remark: '首批试点' },
  { id: 2, inNo: 'RK20261027005', inDate: '2026-10-27', supplier: '云软', operator: '中国电信', iccid: '89860323456789012346', qty: 20, stockQty: 21, receiver: '李四', remark: '弱电施工' },
  { id: 3, inNo: 'RK20261027006', inDate: '2026-10-28', supplier: '云软', operator: '中国移动', iccid: '89860123456789012347', qty: 10, stockQty: 3, receiver: '王五', remark: '库存预警' },
]

export const publicPoolCustomers = [
  { id: 101, storeName: '老四川火锅', customerName: '餐饮连锁A', contact: '张老板', phone: '13500135001', address: '人民路88号', source: '导入', status: '在公海' },
  { id: 102, storeName: '星辰酒店', customerName: '星辰酒店管理', contact: '李经理', phone: '13500135002', address: '解放大道200号', source: '手动', status: '在公海' },
  { id: 103, storeName: '阳光幼儿园', customerName: '阳光教育集团', contact: '王园长', phone: '13500135003', address: '文化路15号', source: '退回', status: '在公海' },
]

export const followUps = [
  { id: 1, customerId: 1, customerName: '智慧社区A区物业', salesName: '张三', type: '电话', content: '确认安装时间，客户要求加路由器', nextPlan: '2026-10-26 上门', createTime: '2026-10-25 14:30' },
  { id: 2, customerId: 2, customerName: '滨江工业园管委会', salesName: '李四', type: '微信', content: '发送了套餐报价', nextPlan: '2026-10-28 回访', createTime: '2026-10-26 10:00' },
  { id: 3, customerId: 4, customerName: '科技初创公司B', salesName: '赵六', type: '上门', content: '现场勘察网络环境，需10账号', nextPlan: '2026-11-01 安装', createTime: '2026-10-30 16:20' },
]

export const integratedList = [
  {
    id: 1, storeName: '红渡小香', customerName: '智慧社区A区物业', salesName: '张三', contactStatus: '正常',
    billMonth: '2026-11', totalAmount: 12000, paidAmount: 12000, unpaidAmount: 0, paymentStatus: '已回款', paymentPlanDate: '2026-11-05',
    contractPeriod: '2026-11-02 至 2027-11-01', contractStatus: '正常', invoiceStatus: '已开票',
    deviceSupplier: '鲲鹏', deviceModel: '618', mac: 'AA:BB:CC:DD:EE:01', imei: '865432041234567', operator: '移动', iccid: '89860123456789012345',
    orderNo: 'GD-20261025-088', assetHealth: '正常',
  },
  {
    id: 2, storeName: '厚贞日式烤肉', customerName: '滨江工业园管委会', salesName: '李四', contactStatus: '正常',
    billMonth: '2026-11', totalAmount: 5000, paidAmount: 2500, unpaidAmount: 2500, paymentStatus: '部分回款', paymentPlanDate: '2026-11-05',
    contractPeriod: '2026-11-06 至 2027-11-05', contractStatus: '即将到期', invoiceStatus: '待开票',
    deviceSupplier: '', deviceModel: '', mac: '', imei: '', operator: '', iccid: '',
    orderNo: 'GD-20261026-092', assetHealth: '正常',
  },
  {
    id: 3, storeName: '必三咖啡', customerName: '连锁便利店总部', salesName: '王五', contactStatus: '中断合作',
    billMonth: '2026-11', totalAmount: 2000, paidAmount: 0, unpaidAmount: 2000, paymentStatus: '已逾期', paymentPlanDate: '2026-11-06',
    contractPeriod: '2026-11-15 至 2027-11-14', contractStatus: '正常', invoiceStatus: '不开票',
    deviceSupplier: '', deviceModel: '', mac: '', imei: '', operator: '移动', iccid: '',
    orderNo: 'GD-20261027-105', assetHealth: '离线预警',
  },
  {
    id: 4, storeName: '稻状元', customerName: '科技初创公司B', salesName: '赵六', contactStatus: '正常',
    billMonth: '2026-11', totalAmount: 25000, paidAmount: 0, unpaidAmount: 25000, paymentStatus: '未回款', paymentPlanDate: '2026-11-07',
    contractPeriod: '2026-11-16 至 2027-11-15', contractStatus: '正常', invoiceStatus: '待开票',
    deviceSupplier: '', deviceModel: '', mac: '', imei: '', operator: '移动(6),电信(4)', iccid: '',
    orderNo: 'GD-20260101-001', assetHealth: '正常',
  },
]

export const schedules = [
  { id: 1, title: '拜访智慧社区A区', customerName: '智慧社区A区物业', salesName: '张三', date: '2026-06-09', time: '14:00', type: '上门', status: '待执行' },
  { id: 2, title: '回访滨江工业园', customerName: '滨江工业园管委会', salesName: '李四', date: '2026-06-09', time: '10:00', type: '电话', status: '待执行' },
  { id: 3, title: '安装预约稻状元', customerName: '科技初创公司B', salesName: '赵六', date: '2026-06-11', time: '09:30', type: '安装', status: '待执行' },
  { id: 4, title: '合同续签沟通', customerName: '厚贞日式烤肉', salesName: '李四', date: '2026-06-08', time: '15:00', type: '电话', status: '已完成' },
]

export const contacts = [
  { id: 1, customerName: '智慧社区A区物业', storeName: '红渡小香', name: '小王', phone: '13800138000', title: '物业经理', isPrimary: true },
  { id: 2, customerName: '智慧社区A区物业', storeName: '红渡小香', name: '李工', phone: '13800138001', title: '工程主管', isPrimary: false },
  { id: 3, customerName: '滨江工业园管委会', storeName: '厚贞日式烤肉', name: '陈经理', phone: '13900139000', title: '行政主任', isPrimary: true },
  { id: 4, customerName: '连锁便利店总部', storeName: '必三咖啡', name: '刘店长', phone: '13700137000', title: '店长', isPrimary: true },
  { id: 5, customerName: '科技初创公司B', storeName: '稻状元', name: '周总', phone: '13600136000', title: 'CEO', isPrimary: true },
]

export const roles = [
  { id: 1, name: '系统管理员', code: 'admin', userCount: 1, menus: '全部菜单', dataScope: '全部数据' },
  { id: 2, name: '销售', code: 'sales', userCount: 3, menus: '客户/工单/日程', dataScope: '仅自己的客户和工单' },
  { id: 3, name: '安装人员', code: 'installer', userCount: 3, menus: '派工/安装登记', dataScope: '分配给自己的工单' },
  { id: 4, name: '财务', code: 'finance', userCount: 1, menus: '财务/关联查询/报表', dataScope: '全部财务数据' },
  { id: 5, name: '仓储', code: 'warehouse', userCount: 1, menus: '设备出入库/库存', dataScope: '全部库存数据' },
]

export const contracts = [
  { id: 1, contractNo: 'SH20261105001', orderNo: 'GD-20261025-088', customerName: '智慧社区A区物业', storeName: '红渡小香', package: '企业旗舰版(5账号)', amount: 12000, startDate: '2026-11-02', endDate: '2027-11-01', status: '正常', cityCode: 'SH' },
  { id: 2, contractNo: 'SH20261106001', orderNo: 'GD-20261026-092', customerName: '滨江工业园管委会', storeName: '厚贞日式烤肉', package: '标准版(2账号)', amount: 5000, startDate: '2026-11-06', endDate: '2027-11-05', status: '即将到期', cityCode: 'SH' },
  { id: 3, contractNo: 'SH20261115001', orderNo: 'GD-20261027-105', customerName: '连锁便利店总部', storeName: '必三咖啡', package: '基础版(1账号)', amount: 2000, startDate: '2026-11-15', endDate: '2027-11-14', status: '正常', cityCode: 'SH' },
  { id: 4, contractNo: 'SH20261116001', orderNo: 'GD-20260101-001', customerName: '科技初创公司B', storeName: '稻状元', package: '企业旗舰版(10账号)', amount: 25000, startDate: '2026-11-16', endDate: '2027-11-15', status: '待生成', cityCode: 'SH' },
]

export const poolConfig = {
  poolName: '默认公海池',
  returnDays: 7,
  notifyBeforeReturn: true,
  enabled: true,
}

export const notifications = [
  { id: 1, type: '工单', title: '2 个工单待派工', content: 'GD-20261027-105 等工单等待派工', time: '10分钟前', read: false, path: '/dispatch' },
  { id: 2, type: '财务', title: '回款逾期提醒', content: '必三咖啡 账单已逾期，未收 ¥2,000', time: '1小时前', read: false, path: '/finance' },
  { id: 3, type: '库存', title: 'SIM 卡库存预警', content: '89860123456789012347 库存仅剩 3', time: '2小时前', read: false, path: '/stock' },
  { id: 4, type: '日程', title: '今日日程提醒', content: '14:00 拜访智慧社区A区物业', time: '今天 08:00', read: false, path: '/schedules' },
  { id: 5, type: '合同', title: '合同即将到期', content: '厚贞日式烤肉 合同将于 30 天内到期', time: '昨天', read: true, path: '/contracts' },
  { id: 6, type: '付费', title: '已完成未付款', content: 'GD-20261026-092 安装完成，待回款 ¥2,500', time: '昨天', read: false, path: '/finance' },
]

export const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))
