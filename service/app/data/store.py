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
        "operator": "移动", "iccid": "89860123456789012345",
    },
    {
        "id": 2, "orderNo": "GD-20261026-092", "salesName": "张三", "storeName": "厚贞日式烤肉",
        "customerName": "滨江工业园管委会", "address": "B区2号楼", "contact": "李经理",
        "contactPhone": "13900139000", "installDate": "2026-10-28", "remark": "",
        "status": "已派工", "installer": "赵云", "deviceSupplier": "", "deviceModel": "",
        "mac": "", "imei": "", "simSupplier": "", "operator": "", "iccid": "",
    },
    {
        "id": 3, "orderNo": "GD-20261027-105", "salesName": "张三", "storeName": "必三咖啡",
        "customerName": "连锁便利店总部", "address": "C区5号铺", "contact": "陈店长",
        "contactPhone": "13700137000", "installDate": "2026-10-29", "remark": "周末安装",
        "status": "待派工", "installer": "", "deviceSupplier": "", "deviceModel": "",
        "mac": "", "imei": "", "simSupplier": "", "operator": "", "iccid": "",
    },
]

PUBLIC_POOL = [
    {"id": 101, "storeName": "稻状元", "customerName": "科技初创公司B", "contact": "刘总",
     "phone": "13600136000", "address": "高新区创业路88号", "source": "导入", "status": "在公海"},
]

SCHEDULES = [
    {"id": 1, "title": "拜访智慧社区A区物业", "type": "上门", "date": str(date.today()),
     "time": "14:00", "salesName": "张三", "status": "待执行"},
]

INSTALLERS = ["赵云", "马超", "黄忠"]


class MemoryStore:
    def __init__(self):
        self.users = deepcopy(USERS)
        self.work_orders = deepcopy(WORK_ORDERS)
        self.public_pool = deepcopy(PUBLIC_POOL)
        self.schedules = deepcopy(SCHEDULES)
        self.work_order_seq = len(WORK_ORDERS)


store = MemoryStore()
