"""内存数据层 — 练手阶段用，后续可换 SQLAlchemy + PostgreSQL"""

from copy import deepcopy
from datetime import date

USERS = [
    {"id": 1, "username": "admin", "password": "123456", "name": "管理员", "role": "admin", "enabled": True},
    {"id": 2, "username": "zhangsan", "password": "123456", "name": "张三", "role": "sales", "enabled": True},
    {"id": 3, "username": "zhaoyun", "password": "123456", "name": "赵云", "role": "installer", "enabled": True},
    {"id": 4, "username": "finance", "password": "123456", "name": "财务小李", "role": "finance", "enabled": True},
    {"id": 5, "username": "xiaoyi", "password": "123456", "name": "小伊姐", "role": "account_owner", "enabled": True},
    {"id": 6, "username": "xingzheng", "password": "123456", "name": "行政小王", "role": "admin_staff", "enabled": True},
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
        "installTimeSlot": "10/28号 上午", "price": "2880x2=5760", "postponeDate": "",
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
        "installTimeSlot": "11/22号 下午", "price": "2880",
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
    {"id": 1, "contractNo": "SH20261105001", "orderNo": "GD-20261025-088", "customerName": "智慧社区A区物业",
     "storeName": "红渡小香", "package": "企业旗舰版(5账号)", "amount": 12000,
     "startDate": "2026-11-02", "endDate": "2027-11-01", "status": "正常", "cityCode": "SH"},
    {"id": 2, "contractNo": "SH20261106001", "orderNo": "GD-20261026-092", "customerName": "滨江工业园管委会",
     "storeName": "厚贞日式烤肉", "package": "标准版(2账号)", "amount": 5000,
     "startDate": "2026-11-06", "endDate": "2027-11-05", "status": "即将到期", "cityCode": "SH"},
    {"id": 3, "contractNo": "SH20261115001", "orderNo": "GD-20261027-105", "customerName": "连锁便利店总部",
     "storeName": "必三咖啡", "package": "基础版(1账号)", "amount": 2000,
     "startDate": "2026-11-15", "endDate": "2027-11-14", "status": "正常", "cityCode": "SH"},
    {"id": 4, "contractNo": "SH20261116001", "orderNo": "GD-20260101-001", "customerName": "科技初创公司B",
     "storeName": "稻状元", "package": "企业旗舰版(10账号)", "amount": 25000,
     "startDate": "2026-11-16", "endDate": "2027-11-15", "status": "待生成", "cityCode": "SH"},
]

CUSTOMERS = [
    {
        "id": 1, "storeName": "红渡小香", "customerName": "智慧社区A区物业", "contact": "小王",
        "phone": "13800138000", "orderNo": "GD-20261025-088", "installDate": "2026-10-27",
        "deviceSupplier": "鲲鹏", "deviceModel": "618", "mac": "AA:BB:CC:DD:EE:01",
        "imei": "865432041234567", "simSupplier": "光和", "operator": "移动",
        "iccid": "89860123456789012345", "iccid2": "", "backupIccid": "",
        "contractPeriod": "2026-01-01 至 2027-01-01", "invoiceType": "增值税专用发票",
        "salesName": "张三", "contactStatus": "正常", "claimTime": "2026-10-20 09:00",
        "lastFollowTime": "2026-10-25 14:30", "wechatId": "wx_xiaowang",
        "financeId": 1, "lastPaymentTime": "2026-11-05", "lastPaymentAmount": 12000,
    },
    {
        "id": 2, "storeName": "厚贞日式烤肉", "customerName": "滨江工业园管委会", "contact": "陈经理",
        "phone": "13900139000", "orderNo": "GD-20261026-092", "installDate": "",
        "deviceSupplier": "", "deviceModel": "", "mac": "", "imei": "", "simSupplier": "",
        "operator": "", "iccid": "", "iccid2": "", "backupIccid": "",
        "contractPeriod": "2026-11-06 至 2027-11-05", "invoiceType": "增值税普通发票",
        "salesName": "李四", "contactStatus": "正常", "claimTime": "2026-10-21 10:30",
        "lastFollowTime": "2026-10-26 10:00", "wechatId": "",
        "financeId": 2, "lastPaymentTime": "2026-11-05", "lastPaymentAmount": 2500,
    },
    {
        "id": 3, "storeName": "必三咖啡", "customerName": "连锁便利店总部", "contact": "刘店长",
        "phone": "13700137000", "orderNo": "GD-20261027-105", "installDate": "",
        "deviceSupplier": "", "deviceModel": "", "mac": "", "imei": "", "simSupplier": "",
        "operator": "移动", "iccid": "", "iccid2": "", "backupIccid": "",
        "contractPeriod": "2026-11-15 至 2027-11-14", "invoiceType": "不开发票",
        "salesName": "王五", "contactStatus": "中断合作", "claimTime": "2026-10-15 14:00",
        "lastFollowTime": "2026-10-18 11:00", "wechatId": "",
        "financeId": 3, "lastPaymentTime": "", "lastPaymentAmount": 0,
    },
    {
        "id": 4, "storeName": "稻状元", "customerName": "科技初创公司B", "contact": "周总",
        "phone": "13600136000", "orderNo": "GD-20260101-001", "installDate": "",
        "deviceSupplier": "", "deviceModel": "", "mac": "", "imei": "", "simSupplier": "",
        "operator": "移动(6),电信(4)", "iccid": "", "iccid2": "", "backupIccid": "",
        "contractPeriod": "2026-11-16 至 2027-11-15", "invoiceType": "待开票",
        "salesName": "赵六", "contactStatus": "待跟进", "claimTime": "2026-10-28 16:00",
        "lastFollowTime": "2026-10-30 16:20", "wechatId": "zhou_ceo",
        "financeId": 4, "lastPaymentTime": "", "lastPaymentAmount": 0,
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
     "status": "已完成", "createTime": "2026-10-25 14:30"},
    {"id": 2, "customerId": 2, "customerName": "滨江工业园管委会", "salesName": "李四",
     "type": "微信", "content": "发送了套餐报价", "nextPlan": "2026-10-28 回访",
     "status": "待完成", "createTime": "2026-10-26 10:00"},
    {"id": 3, "customerId": 4, "customerName": "科技初创公司B", "salesName": "赵六",
     "type": "上门", "content": "现场勘察网络环境，需10账号", "nextPlan": "2026-11-01 安装",
     "status": "待完成", "createTime": "2026-10-30 16:20"},
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
    {"id": 1, "storeName": "红渡小香", "customerName": "智慧社区A区物业", "orderNo": "GD-20261025-088",
     "package": "企业旗舰版 (5账号)", "billMonth": "2026-11", "contractPeriod": "2026-11-02 至 2027-11-01",
     "contractStatus": "正常", "totalAmount": 12000, "paidAmount": 12000, "unpaidAmount": 0,
     "paymentStatus": "已回款", "paymentProgress": 100, "invoiceStatus": "已开票", "salesName": "张三",
     "paymentPlanDate": "2026-11-05", "lastPaymentTime": "2026-11-05",
     "paymentRecords": [
         {"id": 1, "amount": 8000, "time": "2026-11-03", "voucher": "汇款单_8000.jpg", "verified": True},
         {"id": 2, "amount": 4000, "time": "2026-11-05", "voucher": "汇款单_4000.jpg", "verified": True},
     ]},
    {"id": 2, "storeName": "厚贞日式烤肉", "customerName": "滨江工业园管委会", "orderNo": "GD-20261026-092",
     "package": "标准版 (2账号)", "billMonth": "2026-11", "contractPeriod": "2026-11-06 至 2027-11-05",
     "contractStatus": "即将到期", "totalAmount": 5000, "paidAmount": 2500, "unpaidAmount": 2500,
     "paymentStatus": "部分回款", "paymentProgress": 50, "invoiceStatus": "待开票", "salesName": "李四",
     "paymentPlanDate": "2026-11-05", "lastPaymentTime": "2026-11-05",
     "paymentRecords": [
         {"id": 1, "amount": 2500, "time": "2026-11-05", "voucher": "汇款单_2500.jpg", "verified": False},
     ]},
    {"id": 3, "storeName": "必三咖啡", "customerName": "连锁便利店总部", "orderNo": "GD-20261027-105",
     "package": "基础版 (1账号)", "billMonth": "2026-11", "contractPeriod": "2026-11-15 至 2027-11-14",
     "contractStatus": "正常", "totalAmount": 2000, "paidAmount": 0, "unpaidAmount": 2000,
     "paymentStatus": "已逾期", "paymentProgress": 0, "invoiceStatus": "不开票", "salesName": "王五",
     "paymentPlanDate": "2026-11-06", "lastPaymentTime": "", "paymentRecords": []},
    {"id": 4, "storeName": "稻状元", "customerName": "科技初创公司B", "orderNo": "GD-20260101-001",
     "package": "企业旗舰版 (10账号)", "billMonth": "2026-11", "contractPeriod": "2026-11-16 至 2027-11-15",
     "contractStatus": "正常", "totalAmount": 25000, "paidAmount": 0, "unpaidAmount": 25000,
     "paymentStatus": "未回款", "paymentProgress": 0, "invoiceStatus": "待开票", "salesName": "赵六",
     "paymentPlanDate": "2026-11-07", "lastPaymentTime": "", "paymentRecords": []},
]

STOCK_IN = [
    {"id": 1, "inNo": "RK20261027001", "inDate": "2026-10-27", "supplier": "鲲鹏", "model": "鲲鹏618",
     "imei": "865432041234567", "mac": "AA:BB:CC:DD:EE:01", "qty": 10, "stockQty": 12,
     "receiver": "张三", "remark": "首批试点安装"},
    {"id": 2, "inNo": "RK20261027002", "inDate": "2026-10-27", "supplier": "云软", "model": "华为",
     "imei": "865432041234568", "mac": "AA:BB:CC:DD:EE:02", "qty": 20, "stockQty": 21,
     "receiver": "李四", "remark": "需配合弱电施工"},
    {"id": 3, "inNo": "RK20261027003", "inDate": "2026-10-28", "supplier": "云软", "model": "中兴",
     "imei": "865432041234569", "mac": "AA:BB:CC:DD:EE:03", "qty": 10, "stockQty": 11,
     "receiver": "王五", "remark": "替换故障旧机"},
    {"id": 4, "inNo": "RK20261101001", "inDate": "2026-11-01", "supplier": "鲲鹏", "model": "鲲鹏618",
     "imei": "865432041234570", "mac": "AA:BB:CC:DD:EE:04", "qty": 15, "stockQty": 15,
     "receiver": "张三", "remark": "双十一补货"},
    {"id": 5, "inNo": "RK20261105001", "inDate": "2026-11-05", "supplier": "华为政企", "model": "华为AR",
     "imei": "865432041234571", "mac": "AA:BB:CC:DD:EE:05", "qty": 8, "stockQty": 4,
     "receiver": "李四", "remark": "低库存测试"},
    {"id": 6, "inNo": "RK20251115001", "inDate": "2025-11-15", "supplier": "云软", "model": "中兴",
     "imei": "865432041234572", "mac": "AA:BB:CC:DD:EE:06", "qty": 5, "stockQty": 2,
     "receiver": "王五", "remark": "历史入库"},
    {"id": 7, "inNo": "RK20260610001", "inDate": "2026-06-10", "supplier": "鲲鹏", "model": "鲲鹏520",
     "imei": "865432041234573", "mac": "AA:BB:CC:DD:EE:07", "qty": 30, "stockQty": 28,
     "receiver": "赵六", "remark": "夏季备货"},
    {"id": 8, "inNo": "RK20260320001", "inDate": "2026-03-20", "supplier": "华为政企", "model": "华为",
     "imei": "865432041234574", "mac": "AA:BB:CC:DD:EE:08", "qty": 12, "stockQty": 3,
     "receiver": "张三", "remark": "春季采购"},
]

SIM_STOCK_IN = [
    {"id": 1, "inNo": "RK20261027004", "inDate": "2026-10-27", "supplier": "鲲鹏", "operator": "中国移动",
     "iccid": "89860123456789012345", "qty": 10, "stockQty": 12, "receiver": "张三", "remark": "首批试点"},
    {"id": 2, "inNo": "RK20261027005", "inDate": "2026-10-27", "supplier": "云软", "operator": "中国电信",
     "iccid": "89860323456789012346", "qty": 20, "stockQty": 21, "receiver": "李四", "remark": "弱电施工"},
    {"id": 3, "inNo": "RK20261027006", "inDate": "2026-10-28", "supplier": "云软", "operator": "中国移动",
     "iccid": "89860123456789012347", "qty": 10, "stockQty": 3, "receiver": "王五", "remark": "库存预警"},
    {"id": 4, "inNo": "RK20261102001", "inDate": "2026-11-02", "supplier": "光和", "operator": "中国联通",
     "iccid": "89860123456789012348", "qty": 15, "stockQty": 15, "receiver": "赵六", "remark": "联通卡批次"},
    {"id": 5, "inNo": "RK20261108001", "inDate": "2026-11-08", "supplier": "鲲鹏", "operator": "中国移动",
     "iccid": "89860123456789012349", "qty": 8, "stockQty": 2, "receiver": "张三", "remark": "低库存"},
    {"id": 6, "inNo": "RK20251201001", "inDate": "2025-12-01", "supplier": "云软", "operator": "中国电信",
     "iccid": "89860323456789012350", "qty": 50, "stockQty": 45, "receiver": "李四", "remark": "年底备货"},
    {"id": 7, "inNo": "RK20260701001", "inDate": "2026-07-01", "supplier": "光和", "operator": "中国联通",
     "iccid": "89860487152590411606", "qty": 20, "stockQty": 18, "receiver": "王五", "remark": "暑期卡"},
]

STOCK_OUT = [
    {"id": 1, "outNo": "CK20261027001", "outDate": "2026-10-27", "orderNo": "GD-20261025-088",
     "storeName": "红渡小香", "customerName": "智慧社区A区物业", "address": "A区3栋1单元门禁处",
     "model": "鲲鹏618", "imei": "865432041234567", "mac": "AA:BB:CC:DD:EE:01",
     "iccid": "89860123456789012345", "iccid2": "89860123456789012346", "operator": "中国移动", "receiver": "张三", "remark": "首批试点安装"},
    {"id": 2, "outNo": "CK20261027002", "outDate": "2026-10-27", "orderNo": "GD-20261026-092",
     "storeName": "厚贞日式烤肉", "customerName": "滨江工业园管委会", "address": "B座5层会议室监控点",
     "model": "华为", "imei": "865432041234568", "mac": "AA:BB:CC:DD:EE:02",
     "iccid": "89860323456789012346", "iccid2": "", "operator": "中国电信", "receiver": "李四", "remark": "需配合弱电施工"},
    {"id": 3, "outNo": "CK20261103001", "outDate": "2026-11-03", "orderNo": "GD-20261027-105",
     "storeName": "必三咖啡", "customerName": "连锁便利店总部", "address": "C区5号铺",
     "model": "中兴", "imei": "865432041234569", "mac": "AA:BB:CC:DD:EE:03",
     "iccid": "89860123456789012347", "iccid2": "", "operator": "中国移动", "receiver": "王五", "remark": "周末安装出库"},
    {"id": 4, "outNo": "CK20261106001", "outDate": "2026-11-06", "orderNo": "GD-20260101-001",
     "storeName": "稻状元", "customerName": "科技初创公司B", "address": "高新区创业路88号",
     "model": "华为", "imei": "865432041234571", "mac": "AA:BB:CC:DD:EE:05",
     "iccid": "89860123456789012348", "iccid2": "", "operator": "中国联通", "receiver": "赵六", "remark": "企业版"},
    {"id": 5, "outNo": "CK20251122001", "outDate": "2025-11-22", "orderNo": "GD-20251122-031",
     "storeName": "B3咖啡（新天地）", "customerName": "B3咖啡", "address": "新天地广场B3层",
     "model": "华为AR", "imei": "", "mac": "4HB7S24C26000931",
     "iccid": "8986112320403848756", "iccid2": "", "operator": "中国移动", "receiver": "赵云", "remark": "历史出库"},
    {"id": 6, "outNo": "CK20260615001", "outDate": "2026-06-15", "orderNo": "GD-20261025-088",
     "storeName": "红渡小香", "customerName": "智慧社区A区物业", "address": "A区3栋1单元门禁处",
     "model": "鲲鹏520", "imei": "865432041234573", "mac": "AA:BB:CC:DD:EE:07",
     "iccid": "89860323456789012350", "iccid2": "", "operator": "中国电信", "receiver": "张三", "remark": "扩容出库"},
]

ACCOUNT_LEDGER = [
    {"id": 1, "section": "基米网", "direction": "in", "category": "无线网络入账", "amount": 3200,
     "entryDate": "2026-06-01", "remark": "红渡小香", "createdBy": "小伊姐", "createTime": "2026-06-01 10:00"},
    {"id": 2, "section": "基米网", "direction": "out", "category": "流量账单", "amount": 800,
     "entryDate": "2026-06-03", "remarkOption": "鲲鹏卡", "remark": "", "createdBy": "小伊姐", "createTime": "2026-06-03 14:20"},
    {"id": 3, "section": "基米智连", "direction": "in", "category": "其余", "amount": 1500,
     "entryDate": "2026-06-05", "remark": "设备返修退款", "createdBy": "小伊姐", "createTime": "2026-06-05 09:30"},
    {"id": 4, "section": "基米智连", "direction": "out", "category": "工资费用", "amount": 12000,
     "entryDate": "2026-06-10", "remark": "6月安装组工资", "createdBy": "小伊姐", "createTime": "2026-06-10 16:00"},
]

ADMIN_LEDGER = [
    {"id": 1, "category": "日常账单", "amount": 268, "entryDate": "2026-06-02",
     "remark": "办公用品采购", "createdBy": "行政小王", "createTime": "2026-06-02 11:00"},
    {"id": 2, "category": "公司运营账单", "amount": 3500, "entryDate": "2026-06-08",
     "remark": "办公室宽带年费", "createdBy": "行政小王", "createTime": "2026-06-08 15:30"},
    {"id": 3, "category": "日常账单", "amount": 120, "entryDate": "2026-06-12",
     "remark": "快递费", "createdBy": "行政小王", "createTime": "2026-06-12 10:20"},
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
        self.stock_out = deepcopy(STOCK_OUT)
        self.account_ledger = deepcopy(ACCOUNT_LEDGER)
        self.admin_ledger = deepcopy(ADMIN_LEDGER)
        self.work_order_seq = len(WORK_ORDERS)
        self.customer_seq = len(CUSTOMERS)
        self.public_pool_seq = 200
        self.follow_up_seq = len(FOLLOW_UPS)
        self.contact_seq = len(CONTACTS)
        self.return_log_seq = len(RETURN_LOGS)
        self.finance_seq = len(FINANCE)
        self.contract_seq = len(CONTRACTS)
        self.account_ledger_seq = len(ACCOUNT_LEDGER)
        self.admin_ledger_seq = len(ADMIN_LEDGER)


store = MemoryStore()
