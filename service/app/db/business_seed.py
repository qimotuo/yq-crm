"""从 store 种子数据初始化 customers / work_orders 表"""

from sqlalchemy.orm import Session

from app.data.store import CUSTOMERS, WORK_ORDERS
from app.db.models import Customer, WorkOrder


def _customer_from_seed(data: dict) -> Customer:
    iccid2 = data.get("iccid2") or data.get("backupIccid") or ""
    return Customer(
        store_name=data.get("storeName", ""),
        customer_name=data.get("customerName", ""),
        contact=data.get("contact", ""),
        phone=data.get("phone", ""),
        address=data.get("address", ""),
        sales_name=data.get("salesName", ""),
        contact_status=data.get("contactStatus", "正常"),
        order_no=data.get("orderNo", ""),
        install_date=data.get("installDate", ""),
        device_supplier=data.get("deviceSupplier", ""),
        device_model=data.get("deviceModel", ""),
        mac=data.get("mac", ""),
        imei=data.get("imei", ""),
        sim_supplier=data.get("simSupplier", ""),
        operator=data.get("operator", ""),
        iccid=data.get("iccid", ""),
        backup_iccid=iccid2,
        contract_period=data.get("contractPeriod", ""),
        invoice_type=data.get("invoiceType", ""),
        claim_time=data.get("claimTime", ""),
        last_follow_time=data.get("lastFollowTime", ""),
        wechat_id=data.get("wechatId", ""),
        source=data.get("source", ""),
        finance_id=data.get("financeId"),
        last_payment_time=data.get("lastPaymentTime", ""),
        last_payment_amount=float(data.get("lastPaymentAmount") or 0),
    )


def _work_order_from_seed(data: dict, customer_by_order: dict[str, int]) -> WorkOrder:
    order_no = data.get("orderNo", "")
    return WorkOrder(
        order_no=order_no,
        customer_id=customer_by_order.get(order_no),
        sales_name=data.get("salesName", ""),
        store_name=data.get("storeName", ""),
        customer_name=data.get("customerName", ""),
        address=data.get("address", ""),
        contact=data.get("contact", ""),
        contact_phone=data.get("contactPhone", ""),
        install_date=data.get("installDate", ""),
        remark=data.get("remark", ""),
        status=data.get("status", "待派工"),
        installer=data.get("installer", ""),
        device_supplier=data.get("deviceSupplier", ""),
        device_model=data.get("deviceModel", ""),
        mac=data.get("mac", ""),
        imei=data.get("imei", ""),
        sim_supplier=data.get("simSupplier", ""),
        operator=data.get("operator", ""),
        iccid=data.get("iccid", ""),
        backup_iccid=data.get("backupIccid", ""),
        install_remark=data.get("installRemark", ""),
        install_time_slot=data.get("installTimeSlot", ""),
        price=data.get("price", ""),
        postpone_date=data.get("postponeDate", ""),
        fail_reason=data.get("failReason", ""),
        flow_logs=list(data.get("flowLogs") or []),
    )


def seed_business_data(db: Session) -> None:
    if db.query(Customer).count() > 0 or db.query(WorkOrder).count() > 0:
        return

    customer_by_order: dict[str, int] = {}
    for raw in CUSTOMERS:
        row = _customer_from_seed(raw)
        db.add(row)
        db.flush()
        if row.order_no:
            customer_by_order[row.order_no] = row.id

    for raw in WORK_ORDERS:
        db.add(_work_order_from_seed(raw, customer_by_order))

    db.commit()
