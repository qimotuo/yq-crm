"""内存数据层 — 练手阶段用，后续可换 SQLAlchemy + PostgreSQL"""

from copy import deepcopy
from datetime import date

USERS = [
    {"id": 1, "username": "admin", "password": "123456", "name": "管理员", "role": "admin", "enabled": True},
    {"id": 2, "username": "zhangsan", "password": "123456", "name": "张三", "role": "sales", "enabled": True},
    {"id": 3, "username": "zhaoyun", "password": "123456", "name": "赵云", "role": "installer", "enabled": True},
    {"id": 4, "username": "finance", "password": "123456", "name": "财务小李", "role": "finance", "enabled": True},
]

WORK_ORDERS = [
    {
        "id": 1, "orderNo": "GD-20261025-088", "salesName": "张三", "storeName": "红渡小香",
        "customerName": "智慧社区A区物业", "address": "A区3栋1单元门禁处", "contact": "小王",
        "contactPhone": "13800138000", "installDate": "2026-10-27", "remark": "新店，客户要加路由器",
        "status": "已安装", "installer": "赵云", "deviceSupplier": "鲲鹏", "deviceModel": "618",
        "mac": "AA:BB:CC:DD:EE:01", "imei": "865432041234567", "simSupplier": "光和",
        "operator": "移动", "iccid": "89860123456789012345", "backupIccid": "",
        "installRemark": "网络正常，已加路由器",
        "flowLogs": [
            {"time": "2026-10-25 10:30", "action": "创建工单", "operator": "张三", "detail": "销售接单"},
            {"time": "2026-10-26 09:00", "action": "派工", "operator": "管理员", "detail": "派给赵云"},
            {"time": "2026-10-27 14:00", "action": "开始安装", "operator": "赵云", "detail": "状态 → 安装中"},
            {"time": "2026-10-27 16:30", "action": "安装登记", "operator": "赵云", "detail": "鲲鹏618 / MAC AA:BB:CC:DD:EE:01"},
        ],
    },
    {
        "id": 2, "orderNo": "GD-20261026-092", "salesName": "李四", "storeName": "厚贞日式烤肉",
        "customerName": "滨江工业园管委会", "address": "B座5层会议室监控点", "contact": "陈经理",
        "contactPhone": "13900139000", "installDate": "2026-10-28", "remark": "需配合弱电施工",
        "status": "已派工", "installer": "赵云", "deviceSupplier": "", "deviceModel": "",
        "mac": "", "imei": "", "simSupplier": "", "operator": "", "iccid": "", "backupIccid": "",
        "installRemark": "",
        "flowLogs": [
            {"time": "2026-10-26 11:00", "action": "创建工单", "operator": "李四", "detail": "销售接单"},
            {"time": "2026-10-26 15:20", "action": "派工", "operator": "管理员", "detail": "派给赵云"},
        ],
    },
    {
        "id": 3, "orderNo": "GD-20261027-105", "salesName": "王五", "storeName": "必三咖啡",
        "customerName": "连锁便利店总部", "address": "C区5号铺", "contact": "刘店长",
        "contactPhone": "13700137000", "installDate": "2026-10-29", "remark": "周末安装",
        "status": "待派工", "installer": "", "deviceSupplier": "", "deviceModel": "",
        "mac": "", "imei": "", "simSupplier": "", "operator": "", "iccid": "", "backupIccid": "",
        "installRemark": "",
        "flowLogs": [{"time": "2026-10-27 09:15", "action": "创建工单", "operator": "王五", "detail": "销售接单"}],
    },
    {
        "id": 4, "orderNo": "GD-20260101-001", "salesName": "赵六", "storeName": "稻状元",
        "customerName": "科技初创公司B", "address": "高新区创业路88号", "contact": "周总",
        "contactPhone": "13600136000", "installDate": "2026-11-01", "remark": "需10账号企业版",
        "status": "安装中", "installer": "马超", "deviceSupplier": "云软", "deviceModel": "华为",
        "mac": "AA:BB:CC:DD:EE:02", "imei": "865432041234568", "simSupplier": "", "operator": "电信",
        "iccid": "", "backupIccid": "", "installRemark": "弱电施工中",
        "flowLogs": [
            {"time": "2026-10-30 16:00", "action": "创建工单", "operator": "赵六", "detail": "销售接单"},
            {"time": "2026-10-31 10:00", "action": "派工", "operator": "管理员", "detail": "派给马超"},
            {"time": "2026-11-01 09:30", "action": "开始安装", "operator": "马超", "detail": "状态 → 安装中"},
        ],
    },
    {
        "id": 5, "orderNo": "GD-20261020-076", "salesName": "张三", "storeName": "老四川火锅",
        "customerName": "餐饮连锁A", "address": "人民路88号", "contact": "张老板",
        "contactPhone": "13500135001", "installDate": "2026-10-20", "remark": "",
        "status": "失败", "installer": "黄忠", "deviceSupplier": "", "deviceModel": "",
        "mac": "", "imei": "", "simSupplier": "", "operator": "", "iccid": "", "backupIccid": "",
        "installRemark": "", "failReason": "客户不在场，线路未通",
        "flowLogs": [
            {"time": "2026-10-18 14:00", "action": "创建工单", "operator": "张三", "detail": "销售接单"},
            {"time": "2026-10-19 09:00", "action": "派工", "operator": "管理员", "detail": "派给黄忠"},
            {"time": "2026-10-20 11:00", "action": "安装失败", "operator": "黄忠", "detail": "客户不在场，线路未通"},
        ],
    },
    {
        "id": 6, "orderNo": "GD-20251122-031", "salesName": "张三", "storeName": "B3咖啡（新天地）",
        "customerName": "B3咖啡", "address": "新天地广场B3层", "contact": "店长",
        "contactPhone": "13800138088", "installDate": "2025-11-22", "remark": "",
        "status": "已安装", "installer": "赵云", "deviceSupplier": "华为", "deviceModel": "HUAWEI",
        "mac": "4HB7S24C26000931", "imei": "", "simSupplier": "移动", "operator": "移动",
        "iccid": "8986112320403848756", "backupIccid": "89860487152590411606",
        "installRemark": "",
        "flowLogs": [
            {"time": "2025-11-22 14:00", "action": "安装登记", "operator": "赵云",
             "detail": "HUAWEI / MAC 4HB7S24C26000931"},
        ],
    },
]

CONTRACTS = [
    {"contractNo": "SH20261105001", "orderNo": "GD-20261025-088"},
    {"contractNo": "SH20261106001", "orderNo": "GD-20261026-092"},
    {"contractNo": "SH20261115001", "orderNo": "GD-20261027-105"},
    {"contractNo": "SH20261116001", "orderNo": "GD-20260101-001"},
]

CUSTOMERS = [
    {
        "id": 1, "storeName": "红渡小香", "customerName": "智慧社区A区物业", "contact": "小王",
        "phone": "13800138000", "orderNo": "GD-20261025-088", "installDate": "2026-10-27",
        "salesName": "张三", "contactStatus": "正常", "claimTime": "2026-10-20 09:00",
        "lastFollowTime": "2026-10-25 14:30", "wechatId": "wx_xiaowang",
    },
    {
        "id": 2, "storeName": "厚贞日式烤肉", "customerName": "滨江工业园管委会", "contact": "陈经理",
        "phone": "13900139000", "orderNo": "GD-20261026-092", "installDate": "",
        "salesName": "李四", "contactStatus": "正常", "claimTime": "2026-10-21 10:30",
        "lastFollowTime": "2026-10-26 10:00", "wechatId": "",
    },
    {
        "id": 3, "storeName": "必三咖啡", "customerName": "连锁便利店总部", "contact": "刘店长",
        "phone": "13700137000", "orderNo": "GD-20261027-105", "installDate": "",
        "salesName": "王五", "contactStatus": "中断合作", "claimTime": "2026-10-15 14:00",
        "lastFollowTime": "2026-10-18 11:00", "wechatId": "",
    },
    {
        "id": 4, "storeName": "稻状元", "customerName": "科技初创公司B", "contact": "周总",
        "phone": "13600136000", "orderNo": "GD-20260101-001", "installDate": "",
        "salesName": "赵六", "contactStatus": "待跟进", "claimTime": "2026-10-28 16:00",
        "lastFollowTime": "2026-10-30 16:20", "wechatId": "zhou_ceo",
    },
]

PUBLIC_POOL = [
    {"id": 101, "storeName": "老四川火锅", "customerName": "餐饮连锁A", "contact": "张老板",
     "phone": "13500135001", "address": "人民路88号", "source": "导入", "status": "在公海"},
    {"id": 102, "storeName": "星辰酒店", "customerName": "星辰酒店管理", "contact": "李经理",
     "phone": "13500135002", "address": "解放大道200号", "source": "手动", "status": "在公海"},
    {"id": 103, "storeName": "阳光幼儿园", "customerName": "阳光教育集团", "contact": "王园长",
     "phone": "13500135003", "address": "文化路15号", "source": "退回", "status": "在公海"},
]

FOLLOW_UPS = [
    {"id": 1, "customerId": 1, "customerName": "智慧社区A区物业", "salesName": "张三",
     "type": "电话", "content": "确认安装时间，客户要求加路由器", "nextPlan": "2026-10-26 上门",
     "createTime": "2026-10-25 14:30"},
    {"id": 2, "customerId": 2, "customerName": "滨江工业园管委会", "salesName": "李四",
     "type": "微信", "content": "发送了套餐报价", "nextPlan": "2026-10-28 回访",
     "createTime": "2026-10-26 10:00"},
    {"id": 3, "customerId": 4, "customerName": "科技初创公司B", "salesName": "赵六",
     "type": "上门", "content": "现场勘察网络环境，需10账号", "nextPlan": "2026-11-01 安装",
     "createTime": "2026-10-30 16:20"},
]

CONTACTS = [
    {"id": 1, "customerName": "智慧社区A区物业", "storeName": "红渡小香", "name": "小王",
     "phone": "13800138000", "title": "物业经理", "isPrimary": True},
    {"id": 2, "customerName": "智慧社区A区物业", "storeName": "红渡小香", "name": "李工",
     "phone": "13800138001", "title": "工程主管", "isPrimary": False},
    {"id": 3, "customerName": "滨江工业园管委会", "storeName": "厚贞日式烤肉", "name": "陈经理",
     "phone": "13900139000", "title": "行政主任", "isPrimary": True},
    {"id": 4, "customerName": "连锁便利店总部", "storeName": "必三咖啡", "name": "刘店长",
     "phone": "13700137000", "title": "店长", "isPrimary": True},
    {"id": 5, "customerName": "科技初创公司B", "storeName": "稻状元", "name": "周总",
     "phone": "13600136000", "title": "CEO", "isPrimary": True},
]

POOL_CONFIG = {
    "poolName": "默认公海池",
    "poolDescription": "全国宽带业务默认公海客户池",
    "returnDays": 7,
    "notifyBeforeReturn": True,
    "enabled": True,
}

RETURN_LOGS = [
    {"id": 1, "customerName": "阳光教育集团", "storeName": "阳光幼儿园", "salesName": "张三",
     "reason": "手动退回", "returnTime": "2026-10-18 15:30"},
]

SCHEDULES = [
    {"id": 1, "title": "拜访智慧社区A区物业", "type": "上门", "date": str(date.today()),
     "time": "14:00", "salesName": "张三", "status": "待执行"},
]

FINANCE = [
    {"id": 1, "orderNo": "GD-20261025-088", "billMonth": "2026-11", "totalAmount": 12000,
     "paidAmount": 12000, "unpaidAmount": 0, "paymentStatus": "已回款", "paymentPlanDate": "2026-11-05"},
    {"id": 2, "orderNo": "GD-20261026-092", "billMonth": "2026-11", "totalAmount": 5000,
     "paidAmount": 2500, "unpaidAmount": 2500, "paymentStatus": "部分回款", "paymentPlanDate": "2026-11-05"},
    {"id": 3, "orderNo": "GD-20261027-105", "billMonth": "2026-11", "totalAmount": 2000,
     "paidAmount": 0, "unpaidAmount": 2000, "paymentStatus": "已逾期", "paymentPlanDate": "2026-11-06"},
    {"id": 4, "orderNo": "GD-20260101-001", "billMonth": "2026-11", "totalAmount": 25000,
     "paidAmount": 0, "unpaidAmount": 25000, "paymentStatus": "未回款", "paymentPlanDate": "2026-11-07"},
]

STOCK_IN = [
    {"id": 1, "model": "鲲鹏618", "stockQty": 12},
    {"id": 2, "model": "华为", "stockQty": 21},
    {"id": 3, "model": "中兴", "stockQty": 11},
]

SIM_STOCK_IN = [
    {"id": 1, "iccid": "89860123456789012345", "stockQty": 12},
    {"id": 2, "iccid": "89860323456789012346", "stockQty": 21},
    {"id": 3, "iccid": "89860123456789012347", "stockQty": 3},
]

INSTALLERS = ["赵云", "马超", "黄忠"]


class MemoryStore:
    def __init__(self):
        self.users = deepcopy(USERS)
        self.work_orders = deepcopy(WORK_ORDERS)
        self.contracts = deepcopy(CONTRACTS)
        self.customers = deepcopy(CUSTOMERS)
        self.public_pool = deepcopy(PUBLIC_POOL)
        self.follow_ups = deepcopy(FOLLOW_UPS)
        self.contacts = deepcopy(CONTACTS)
        self.pool_config = deepcopy(POOL_CONFIG)
        self.return_logs = deepcopy(RETURN_LOGS)
        self.schedules = deepcopy(SCHEDULES)
        self.finance = deepcopy(FINANCE)
        self.stock_in = deepcopy(STOCK_IN)
        self.sim_stock_in = deepcopy(SIM_STOCK_IN)
        self.work_order_seq = len(WORK_ORDERS)
        self.customer_seq = len(CUSTOMERS)
        self.public_pool_seq = 200
        self.follow_up_seq = len(FOLLOW_UPS)
        self.contact_seq = len(CONTACTS)
        self.return_log_seq = len(RETURN_LOGS)


store = MemoryStore()
