"""安装登记后生成账单和待生成合同，未满 8 天不编号。测完删除本次数据。"""

import json
import urllib.request
from datetime import date, timedelta

from app.db.models import Contract, Customer, Finance, Notification, WorkOrder
from app.db.session import SessionLocal
from app.services.install_followup import _amount, generate_due_contracts

BASE = "http://127.0.0.1:8000/api"
MARK = "测试安装闭环"
PHONE = "13900007701"


def check(cond, msg):
    if not cond:
        raise SystemExit(msg)


def test_amount():
    check(_amount("2880x2=5760") == 5760, _amount("2880x2=5760"))
    check(_amount("2880") == 2880, _amount("2880"))
    check(_amount("") == 0, "empty")
    check(_amount("1,880") == 1880, _amount("1,880"))


def api(method, path, token="", body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    with urllib.request.urlopen(req) as resp:
        payload = json.loads(resp.read().decode())
    if payload.get("code") != 200:
        raise SystemExit(f"{method} {path} {payload}")
    return payload["data"]


def cleanup(order_no):
    db = SessionLocal()
    try:
        order = db.query(WorkOrder).filter(WorkOrder.order_no == order_no).first()
        oid = order.id if order else 0
        db.query(Contract).filter(Contract.order_no == order_no).delete()
        db.query(Finance).filter(Finance.order_no == order_no).delete()
        db.query(Customer).filter(Customer.order_no == order_no).delete()
        if oid:
            db.query(Notification).filter(Notification.source_id == oid, Notification.source_type == "work_order").delete()
            db.query(WorkOrder).filter(WorkOrder.id == oid).delete()
        db.commit()
    finally:
        db.close()


def test_flow():
    token = api("POST", "/auth/login", body={"username": "admin", "password": "123456"})["token"]
    installers = api("GET", "/installers", token)
    check(installers, "没有安装人员")
    today = date.today().isoformat()
    order = api("POST", "/work-orders", token, {
        "storeName": MARK,
        "customerName": MARK,
        "address": "测试路 1 号",
        "contact": "测试员",
        "contactPhone": PHONE,
        "installDate": today,
        "remark": "自动化测试",
        "price": "2880x2=5760",
    })
    oid = order["id"]
    order_no = order["orderNo"]
    try:
        check(order["status"] == "待派工", order["status"])
        check(order["price"] == "2880x2=5760", order["price"])
        dispatched = api("PUT", "/work-orders/dispatch", token, {"id": oid, "installer": installers[0]})
        check(dispatched["status"] == "已派工", dispatched["status"])
        started = api("PUT", "/work-orders/status", token, {"id": oid, "status": "安装中"})
        check(started["status"] == "安装中", started["status"])
        saved = api("PUT", "/work-orders/install", token, {
            "id": oid,
            "deviceSupplier": "鲲鹏",
            "deviceModel": "618",
            "mac": "AA:BB:CC:DD:EE:99",
            "imei": "860000000000099",
            "simSupplier": "光和",
            "operator": "移动",
            "iccid": "89860000000000000099",
            "backupIccid": "89860000000000000098",
            "installRemark": "测试登记",
        })
        check(saved["status"] == "已安装", saved["status"])
        fin = api("GET", f"/finance?orderNo={order_no}", token)["list"]
        check(len(fin) == 1, fin)
        check(fin[0]["totalAmount"] == 5760, fin[0]["totalAmount"])
        check(fin[0]["paymentStatus"] == "未回款", fin[0]["paymentStatus"])
        check(fin[0]["contractStatus"] == "待生成", fin[0]["contractStatus"])
        cons = api("GET", f"/contracts?orderNo={order_no}", token)["list"]
        check(len(cons) == 1, cons)
        check(cons[0]["status"] == "待生成", cons[0]["status"])
        check(cons[0]["amount"] == 5760, cons[0]["amount"])
        check(str(cons[0]["contractNo"]).startswith("待"), cons[0]["contractNo"])
        again = api("PUT", "/work-orders/install", token, {
            "id": oid,
            "deviceSupplier": "鲲鹏",
            "deviceModel": "618",
            "mac": "AA:BB:CC:DD:EE:99",
            "imei": "860000000000099",
        })
        check(again["status"] == "已安装", again["status"])
        fin2 = api("GET", f"/finance?orderNo={order_no}", token)["list"]
        check(len(fin2) == 1, "重复登记不应再造账单")
        pending_before = SessionLocal().query(Contract).filter(Contract.status == "待生成").count()
        result = generate_due_contracts(SessionLocal())
        check(result["generated"] == 0, result)
        still = api("GET", f"/contracts?orderNo={order_no}", token)["list"][0]
        check(still["status"] == "待生成", still["status"])
        check(SessionLocal().query(Contract).filter(Contract.status == "待生成").count() == pending_before, "提前生成了其他合同")
        done = api("PUT", "/work-orders/status", token, {"id": oid, "status": "已完成"})
        check(done["status"] == "已完成", done["status"])
    finally:
        cleanup(order_no)


if __name__ == "__main__":
    test_amount()
    test_flow()
    print("install follow-up ok")
