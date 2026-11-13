"""全链路追溯：工单 → 派工 → 出库 → 安装 → 财务 → 合同"""

from sqlalchemy.orm import Session

from app.db.models import Contract, Customer, Finance, StockIn, StockOut, WorkOrder
from app.db.serialize import work_order_to_dict


def _match(value: str, text: str) -> bool:
    if not text:
        return False
    return value.lower() in text.lower() or text.lower() in value.lower()


def _find_order_by_no(db: Session, value: str) -> WorkOrder | None:
    order = db.query(WorkOrder).filter(WorkOrder.order_no == value).first()
    if order:
        return order
    return (
        db.query(WorkOrder)
        .filter(WorkOrder.order_no.ilike(f"%{value}%"))
        .order_by(WorkOrder.id.desc())
        .first()
    )


def _find_order_by_mac(db: Session, value: str) -> WorkOrder | None:
    order = (
        db.query(WorkOrder)
        .filter(WorkOrder.mac.ilike(f"%{value}%"))
        .order_by(WorkOrder.id.desc())
        .first()
    )
    if order:
        return order
    out = db.query(StockOut).filter(StockOut.mac.ilike(f"%{value}%")).order_by(StockOut.id.desc()).first()
    if out:
        return _find_order_by_no(db, out.order_no)
    return None


def _find_order_by_iccid(db: Session, value: str) -> WorkOrder | None:
    order = (
        db.query(WorkOrder)
        .filter(
            (WorkOrder.iccid.ilike(f"%{value}%")) | (WorkOrder.backup_iccid.ilike(f"%{value}%"))
        )
        .order_by(WorkOrder.id.desc())
        .first()
    )
    if order:
        return order
    like = f"%{value}%"
    out = (
        db.query(StockOut)
        .filter(
            (StockOut.iccid.ilike(like))
            | (StockOut.iccid2.ilike(like))
            | (StockOut.mobile_no.ilike(like))
            | (StockOut.telecom_no.ilike(like))
            | (StockOut.replaced_card_no.ilike(like))
        )
        .order_by(StockOut.id.desc())
        .first()
    )
    if out:
        return _find_order_by_no(db, out.order_no)
    inbound = (
        db.query(StockIn)
        .filter(
            (StockIn.mobile_no.ilike(like))
            | (StockIn.telecom_no.ilike(like))
            | (StockIn.replaced_card_no.ilike(like))
        )
        .order_by(StockIn.id.desc())
        .first()
    )
    if inbound and inbound.order_no:
        return _find_order_by_no(db, inbound.order_no)
    return None


def _find_customer(db: Session, value: str) -> Customer | None:
    return (
        db.query(Customer)
        .filter(
            (Customer.customer_name.ilike(f"%{value}%")) | (Customer.store_name.ilike(f"%{value}%"))
        )
        .order_by(Customer.id.desc())
        .first()
    )


def _finance_by_order(db: Session, order_no: str) -> dict | None:
    row = db.query(Finance).filter(Finance.order_no == order_no).first()
    if not row:
        return None
    return {
        "totalAmount": row.total_amount,
        "paidAmount": row.paid_amount,
        "paymentStatus": row.payment_status,
    }


def _finance_by_id(db: Session, finance_id: int) -> dict | None:
    row = db.query(Finance).filter(Finance.id == finance_id).first()
    if not row:
        return None
    return {
        "totalAmount": row.total_amount,
        "paidAmount": row.paid_amount,
        "paymentStatus": row.payment_status,
    }


def _contract_by_order(db: Session, order_no: str) -> dict | None:
    row = db.query(Contract).filter(Contract.order_no == order_no).first()
    if not row:
        return None
    return {"contractNo": row.contract_no, "status": row.status, "amount": row.amount, "orderNo": row.order_no}


def _contract_by_no(db: Session, value: str) -> dict | None:
    row = db.query(Contract).filter(Contract.contract_no.ilike(f"%{value}%")).first()
    if not row:
        return None
    return {"contractNo": row.contract_no, "status": row.status, "amount": row.amount, "orderNo": row.order_no}


def _stock_outs_by_order(db: Session, order_no: str) -> list[dict]:
    rows = db.query(StockOut).filter(StockOut.order_no == order_no).all()
    return [{
        "model": r.model, "outNo": r.out_no, "mac": r.mac,
        "storeName": r.store_name, "mobileNo": r.mobile_no,
        "telecomNo": r.telecom_no, "replacedCardNo": r.replaced_card_no,
    } for r in rows]


def _resolve_context(db: Session, trace_type: str, value: str) -> tuple[WorkOrder | None, Customer | None, str]:
    value = value.strip()
    order: WorkOrder | None = None
    customer: Customer | None = None
    key = value

    if trace_type == "orderNo":
        order = _find_order_by_no(db, value)
        key = order.order_no if order else value
    elif trace_type == "mac":
        order = _find_order_by_mac(db, value)
        key = value.upper() if order else value
    elif trace_type == "iccid":
        order = _find_order_by_iccid(db, value)
        key = value
    elif trace_type == "contractNo":
        contract = _contract_by_no(db, value)
        if contract:
            key = contract.get("contractNo", value)
            order = _find_order_by_no(db, contract.get("orderNo", ""))
    elif trace_type == "customer":
        customer = _find_customer(db, value)
        if customer:
            key = customer.customer_name
            if customer.order_no:
                order = _find_order_by_no(db, customer.order_no)
    else:
        order = _find_order_by_no(db, value)

    if order and not customer and order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    if order and not customer and order.customer_name:
        customer = _find_customer(db, order.customer_name)

    return order, customer, key


def _build_steps(db: Session, order: WorkOrder | None, customer: Customer | None) -> list[str]:
    if not order and not customer:
        return []

    steps: list[str] = []
    order_no = order.order_no if order else (customer.order_no if customer else "")

    if customer:
        steps.append(f"客户: {customer.customer_name}（{customer.store_name or '-'}）")
        if customer.sales_name:
            steps.append(f"销售: {customer.sales_name}")
    elif order:
        steps.append(f"客户: {order.customer_name}（{order.store_name or '-'}）")

    if order:
        od = work_order_to_dict(order)
        steps.append(f"工单: {od['orderNo']} / 状态 {od['status']}")
        if od.get("installerName"):
            steps.append(f"派工: {od['installerName']} / {od.get('dispatchTime') or '-'}")
        elif od["status"] == "待派工":
            steps.append("派工: 待分配安装员")

    outs = _stock_outs_by_order(db, order_no) if order_no else []
    if outs:
        for out in outs:
            cards = " / ".join(
                part for part in (
                    f"移动 {out['mobileNo']}" if out.get("mobileNo") else "",
                    f"电信 {out['telecomNo']}" if out.get("telecomNo") else "",
                    f"旧卡 {out['replacedCardNo']}" if out.get("replacedCardNo") else "",
                ) if part
            )
            line = f"出库: {out.get('model', '-')} / {out.get('outNo', '-')} / MAC {out.get('mac', '-')}"
            if out.get("storeName"):
                line += f" / {out['storeName']}"
            if cards:
                line += f" / {cards}"
            steps.append(line)
    elif order and (order.mac or order.device_model):
        steps.append(
            f"设备: {order.device_supplier or '-'} {order.device_model or '-'} / MAC {order.mac or '-'}"
        )

    if order and order.status in ("已安装", "已完成", "安装成功"):
        steps.append(f"安装登记: {order.install_date or '-'} / {order.status}")
    elif order and order.install_date:
        steps.append(f"安装登记: {order.install_date}")

    fin = _finance_by_order(db, order_no) if order_no else None
    if not fin and customer and customer.finance_id:
        fin = _finance_by_id(db, customer.finance_id)
    if fin:
        steps.append(
            f"财务: 应收 ¥{fin.get('totalAmount', 0)} / 已收 ¥{fin.get('paidAmount', 0)} / {fin.get('paymentStatus', '-')}"
        )

    contract = _contract_by_order(db, order_no) if order_no else None
    if contract:
        steps.append(
            f"合同: {contract.get('contractNo', '-')} / {contract.get('status', '-')} / ¥{contract.get('amount', 0)}"
        )

    return steps


def trace_query(db: Session, trace_type: str, value: str) -> dict | None:
    value = (value or "").strip()
    if not value:
        return None

    order, customer, key = _resolve_context(db, trace_type, value)
    steps = _build_steps(db, order, customer)

    if not steps:
        return {
            "key": value,
            "steps": [f'未找到 "{value}" 的完整链路', "请尝试: 智慧社区 / GD-20261025 / AA:BB:CC / SH20261105001"],
        }

    return {"key": key, "steps": steps}
