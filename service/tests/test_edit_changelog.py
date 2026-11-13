"""编辑与修改记录。用独立数据测完即删。"""

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

from app.core.security import hash_password
from app.db.models import Contract, Customer, Finance, Notification, OperationLog, Role, StockOut, User, WorkOrder
from app.db.session import SessionLocal

BASE = "http://127.0.0.1:8000/api"
MARK = "审查编辑店"
PASS = []
FAIL = []


def line(ok, name, detail):
    (PASS if ok else FAIL).append(f"{name}：{detail}")
    print(("通过" if ok else "失败"), name, detail)


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
    try:
        with urllib.request.urlopen(req) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        payload = json.loads(exc.read().decode())
    if payload.get("code") != 200:
        raise RuntimeError(f"{method} {path} {payload.get('message') or payload}")
    return payload["data"]


def api_code(method, path, token="", body=None):
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
    try:
        with urllib.request.urlopen(req) as resp:
            payload = json.loads(resp.read().decode())
            status = resp.status
    except urllib.error.HTTPError as exc:
        payload = json.loads(exc.read().decode())
        status = exc.code
    return status, payload


def changes(token, module, target_id):
    qs = urllib.parse.urlencode({"module": module, "targetId": str(target_id)})
    return api("GET", "/change-logs?" + qs, token)["list"]


def finance_body(order_no, **extra):
    body = {
        "storeName": MARK,
        "customerName": MARK,
        "orderNo": order_no,
        "package": "原套餐",
        "billMonth": "2026-11",
        "contractPeriod": "2026-11-01 至 2027-11-01",
        "totalAmount": 1880,
        "paidAmount": 0,
        "paymentPlanDate": "2026-12-01",
        "salesName": "审查销售",
        "invoiceStatus": "待开票",
    }
    body.update(extra)
    return body


def contract_body(order_no, **extra):
    body = {
        "templateKey": "zhilian",
        "orderNo": order_no,
        "customerName": MARK,
        "signerName": "测签",
        "signerPhone": "13800138000",
        "signerIdNo": "310101199001011234",
        "signDate": "2026-11-01",
        "storeName": MARK,
        "package": "原套餐",
        "amount": 1880,
        "startDate": "2026-11-01",
        "endDate": (date.today() - timedelta(days=3)).isoformat(),
        "cityCode": "SH",
        "status": "正常",
    }
    body.update(extra)
    return body


def cleanup(ids, log_from):
    db = SessionLocal()
    try:
        order_nos = ids["orders"]
        if order_nos:
            db.query(StockOut).filter(StockOut.order_no.in_(order_nos)).delete(synchronize_session=False)
            db.query(Contract).filter(Contract.order_no.in_(order_nos)).delete(synchronize_session=False)
            db.query(Finance).filter(Finance.order_no.in_(order_nos)).delete(synchronize_session=False)
            db.query(Customer).filter(Customer.order_no.in_(order_nos)).delete(synchronize_session=False)
        if ids["order_ids"]:
            db.query(Notification).filter(
                Notification.source_type == "work_order",
                Notification.source_id.in_(ids["order_ids"]),
            ).delete(synchronize_session=False)
            db.query(WorkOrder).filter(WorkOrder.id.in_(ids["order_ids"])).delete(synchronize_session=False)
        db.query(Customer).filter(Customer.store_name == MARK).delete(synchronize_session=False)
        db.query(Finance).filter(Finance.store_name == MARK).delete(synchronize_session=False)
        db.query(Contract).filter(Contract.store_name == MARK).delete(synchronize_session=False)
        targets = [str(i) for i in ids["log_ids"]]
        if targets:
            db.query(OperationLog).filter(OperationLog.target_id.in_(targets)).delete(synchronize_session=False)
        db.query(OperationLog).filter(OperationLog.detail.contains(MARK)).delete(synchronize_session=False)
        db.query(User).filter(User.username.in_(["audit_finance_tmp", "audit_sales_a", "audit_sales_b"])).delete(synchronize_session=False)
        if log_from:
            db.query(OperationLog).filter(OperationLog.id > log_from).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def main():
    ids = {"orders": [], "order_ids": [], "log_ids": []}
    db = SessionLocal()
    try:
        log_from = db.query(OperationLog.id).order_by(OperationLog.id.desc()).limit(1).scalar() or 0
    finally:
        db.close()
    token = api("POST", "/auth/login", body={"username": "admin", "password": "123456"})["token"]
    db = SessionLocal()
    try:
        for username, name in (("audit_sales_a", "审查销售A"), ("audit_sales_b", "审查销售B")):
            if not db.query(User).filter(User.username == username).first():
                db.add(User(
                    username=username,
                    password_hash=hash_password("123456"),
                    name=name,
                    role_code="sales",
                    enabled=True,
                    dept_code="sales",
                ))
        db.commit()
    finally:
        db.close()
    try:
        customer = api("POST", "/customers", token, {
            "storeName": MARK, "customerName": MARK, "contact": "测联系人",
            "phone": "13800138001", "address": "", "salesName": "审查销售A", "orderNo": "",
        })
        ids["log_ids"].append(customer["id"])
        api("PUT", "/customers/update", token, {"id": customer["id"], "address": "测试地址"})
        logs = changes(token, "客户", customer["id"])
        hit = next((c for row in logs for c in row["changes"] if c["field"] == "address"), None)
        line(bool(hit and hit["before"] == "" and hit["after"] == "测试地址"), "客户修改记录", hit)

        order = api("POST", "/work-orders", token, {
            "storeName": MARK, "customerName": MARK, "address": "测试路 1 号",
            "contact": "测联系人", "contactPhone": "13800138001",
            "installDate": "2026-11-10", "remark": "", "price": "1880",
        })
        ids["orders"].append(order["orderNo"])
        ids["order_ids"].append(order["id"])
        ids["log_ids"].append(order["id"])
        api("PUT", "/work-orders/update", token, {"id": order["id"], "remark": "改后备注", "price": "1999"})
        logs = changes(token, "工单", order["id"])
        fields = {c["field"]: c for row in logs for c in row["changes"]}
        line(
            fields.get("remark", {}).get("after") == "改后备注" and fields.get("price", {}).get("after") == "1999",
            "工单修改记录",
            {k: fields[k] for k in fields if k in ("remark", "price")},
        )

        api("PUT", "/customers/update", token, {
            "id": customer["id"], "orderNo": order["orderNo"], "iccid": "8986000000000000001", "salesName": "审查销售A",
        })
        bill = api("POST", "/finance", token, finance_body(order["orderNo"]))
        ids["log_ids"].append(bill["id"])
        db = SessionLocal()
        try:
            linked = db.query(Customer).filter(Customer.id == customer["id"]).one().finance_id
        finally:
            db.close()
        line(linked == bill["id"], "新建账单挂到客户", linked)

        api("PUT", "/finance/update", token, finance_body(order["orderNo"], id=bill["id"], package="新套餐"))
        logs = changes(token, "财务", bill["id"])
        hit = next((c for row in logs for c in row["changes"] if c["field"] == "package"), None)
        line(bool(hit and hit["before"] == "原套餐" and hit["after"] == "新套餐"), "财务修改记录", hit)

        api("PUT", "/finance/update", token, finance_body(order["orderNo"], id=bill["id"], package="新套餐", paidAmount=100))
        db = SessionLocal()
        try:
            row = db.query(Finance).filter(Finance.id == bill["id"]).one()
            paid = row.paid_amount
            records = list(row.payment_records or [])
        finally:
            db.close()
        line(
            paid == 100 and len(records) == 1 and float(records[0]["amount"]) == 100,
            "直接改已收记入回款明细",
            {"paid": paid, "records": records},
        )
        api("PUT", "/finance/payment", token, {"id": bill["id"], "paidAmount": 150, "verified": True})
        db = SessionLocal()
        try:
            row = db.query(Finance).filter(Finance.id == bill["id"]).one()
            amounts = [float(item["amount"]) for item in (row.payment_records or [])]
            paid_after = row.paid_amount
        finally:
            db.close()
        line(paid_after == 150 and amounts == [100.0, 50.0], "录入回款按已有明细补差额", {"paid": paid_after, "amounts": amounts})

        order2 = api("POST", "/work-orders", token, {
            "storeName": MARK, "customerName": MARK + "乙", "address": "测试路 2 号",
            "contact": "乙", "contactPhone": "13800138002", "installDate": "2026-11-11", "price": "1000",
        })
        ids["orders"].append(order2["orderNo"])
        ids["order_ids"].append(order2["id"])
        customer2 = api("POST", "/customers", token, {
            "storeName": MARK, "customerName": MARK + "乙", "phone": "13800138002",
            "salesName": "审查销售B", "orderNo": order2["orderNo"],
        })
        ids["log_ids"].append(customer2["id"])
        api("PUT", "/finance/update", token, finance_body(order2["orderNo"], id=bill["id"], package="新套餐", paidAmount=150, customerName=MARK + "乙"))
        db = SessionLocal()
        try:
            old_link = db.query(Customer).filter(Customer.id == customer["id"]).one().finance_id
            new_link = db.query(Customer).filter(Customer.id == customer2["id"]).one().finance_id
        finally:
            db.close()
        line(new_link == bill["id"] and old_link in (None, 0), "改工单号后旧客户应摘掉账单", {"old": old_link, "new": new_link})

        contract = api("POST", "/contracts", token, contract_body(order["orderNo"]))
        ids["log_ids"].append(contract["id"])
        shown = contract["status"]
        api("PUT", "/contracts/update", token, contract_body(order["orderNo"], id=contract["id"], package="新套餐", status="正常"))
        saved = api("GET", "/contracts?orderNo=" + urllib.parse.quote(order["orderNo"]), token)["list"][0]
        logs = changes(token, "合同", contract["id"])
        hit = next((c for row in logs for c in row["changes"] if c["field"] == "package"), None)
        line(bool(hit and hit["after"] == "新套餐") and saved["status"] == shown, "合同修改且状态按截止日期保持", {"status": saved["status"], "log": hit})

        db = SessionLocal()
        try:
            outs_before = db.query(StockOut).filter(StockOut.order_no == order2["orderNo"]).count()
        finally:
            db.close()
        integrated = api("GET", "/integrated?keyword=" + urllib.parse.quote(order2["orderNo"]), token)["list"]
        item = next(row for row in integrated if row["orderNo"] == order2["orderNo"])
        payload = {key: item.get(key) or "" for key in (
            "salesName", "storeName", "customerName", "contact", "phone", "contactStatus", "installer",
            "installDate", "deviceSupplier", "deviceModel", "deviceCost", "mac", "imei", "simSupplier",
            "telecomNo", "mobileNo", "oldCardNo", "cardPackage", "cardCost", "cardExpireDate",
            "contractPeriod", "billMonth", "price", "invoiceStatus", "paymentPlanDate",
        )}
        payload.update({"id": item["id"], "totalAmount": item.get("totalAmount") or 0, "salesName": ""})
        api("PUT", "/integrated/update", token, payload)
        db = SessionLocal()
        try:
            sales = db.query(Customer).filter(Customer.id == customer2["id"]).one().sales_name
            outs_after = db.query(StockOut).filter(StockOut.order_no == order2["orderNo"]).count()
        finally:
            db.close()
        line(sales == "审查销售B", "关联保存不应清空销售", sales)
        line(outs_after == outs_before, "只改销售不应新建出库单", {"before": outs_before, "after": outs_after})

        payload["telecomNo"] = "8986000000000000099"
        payload["salesName"] = "审查销售B"
        api("PUT", "/integrated/update", token, payload)
        db = SessionLocal()
        try:
            out = db.query(StockOut).filter(StockOut.order_no == order2["orderNo"]).first()
        finally:
            db.close()
        shown = next(row for row in api("GET", "/integrated?keyword=" + urllib.parse.quote(order2["orderNo"]), token)["list"] if row["orderNo"] == order2["orderNo"])
        line(out is None and shown.get("telecomNo") == "8986000000000000099", "改卡号不新建出库单并保留卡号", None if out is None else {"outNo": out.out_no, "remark": out.remark, "telecom": out.telecom_no})

        db = SessionLocal()
        try:
            role = db.query(Role).filter(Role.code == "finance").one()
            ops = list(role.operations or [])
            db.add(User(
                username="audit_finance_tmp",
                password_hash=hash_password("123456"),
                name="审查财务",
                role_code="finance",
                enabled=True,
                dept_code="finance",
            ))
            db.commit()
        finally:
            db.close()
        login = api("POST", "/auth/login", body={"username": "audit_finance_tmp", "password": "123456"})
        _, result = api_code("PUT", "/customers/update", login["token"], {"id": customer["id"], "address": "财务越权"})
        _, deleted = api_code("DELETE", "/customers?id=" + str(customer["id"]), login["token"])
        line("customer:edit" in ops or result.get("code") == 403, "财务无编辑权限时不能改客户", {"opsHasEdit": "customer:edit" in ops, "code": result.get("code"), "msg": result.get("message")})
        line(deleted.get("code") == 403, "财务无编辑权限时不能删除客户", {"code": deleted.get("code"), "msg": deleted.get("message")})
    finally:
        cleanup(ids, log_from)
        print(f"\n通过 {len(PASS)}，失败 {len(FAIL)}")
        for item in FAIL:
            print(" -", item)


if __name__ == "__main__":
    main()
