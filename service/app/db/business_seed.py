"""从 store 种子数据初始化业务表（首次启动时）"""

from sqlalchemy.orm import Session

from app.data.store import (
    ACCOUNT_LEDGER,
    ADMIN_LEDGER,
    CONTACTS,
    CONTRACTS,
    CUSTOMERS,
    FINANCE,
    PUBLIC_POOL,
    RETURN_LOGS,
    SIM_STOCK_IN,
    STOCK_IN,
    STOCK_OUT,
    WORK_ORDERS,
)
from app.db.models import (
    AccountLedgerEntry,
    AdminLedgerEntry,
    Contact,
    Contract,
    Customer,
    Finance,
    PublicPoolCustomer,
    ReturnLog,
    SimStockIn,
    StockIn,
    StockOut,
    WorkOrder,
)


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
        price=data.get("price", ""),
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
        install_photos=list(data.get("installPhotos") or []),
        flow_logs=list(data.get("flowLogs") or []),
    )


def _seed_finance(db: Session) -> None:
    if db.query(Finance).count() > 0:
        return
    for raw in FINANCE:
        db.add(Finance(
            store_name=raw.get("storeName", ""),
            customer_name=raw.get("customerName", ""),
            order_no=raw.get("orderNo", ""),
            package=raw.get("package", ""),
            bill_month=raw.get("billMonth", ""),
            contract_period=raw.get("contractPeriod", ""),
            contract_status=raw.get("contractStatus", "正常"),
            total_amount=float(raw.get("totalAmount") or 0),
            paid_amount=float(raw.get("paidAmount") or 0),
            unpaid_amount=float(raw.get("unpaidAmount") or 0),
            payment_status=raw.get("paymentStatus", "未回款"),
            payment_progress=int(raw.get("paymentProgress") or 0),
            invoice_status=raw.get("invoiceStatus", "待开票"),
            sales_name=raw.get("salesName", ""),
            payment_plan_date=raw.get("paymentPlanDate", ""),
            last_payment_time=raw.get("lastPaymentTime", ""),
            payment_records=list(raw.get("paymentRecords") or []),
        ))


def _seed_contracts(db: Session) -> None:
    if db.query(Contract).count() > 0:
        return
    sales_by_order = {c.get("orderNo", ""): c.get("salesName", "") for c in CUSTOMERS}
    for raw in CONTRACTS:
        db.add(Contract(
            contract_no=raw.get("contractNo", ""),
            order_no=raw.get("orderNo", ""),
            customer_name=raw.get("customerName", ""),
            signer_name=raw.get("signerName", ""),
            signer_phone=raw.get("signerPhone", ""),
            signer_id_no=raw.get("signerIdNo", ""),
            sign_date=raw.get("signDate", ""),
            store_name=raw.get("storeName", ""),
            package=raw.get("package", ""),
            amount=float(raw.get("amount") or 0),
            start_date=raw.get("startDate", ""),
            end_date=raw.get("endDate", ""),
            status=raw.get("status", "正常"),
            city_code=raw.get("cityCode", "SH"),
            sales_name=raw.get("salesName") or sales_by_order.get(raw.get("orderNo", ""), ""),
        ))


def _seed_stock(db: Session) -> None:
    if db.query(StockIn).count() == 0:
        for raw in STOCK_IN:
            db.add(StockIn(
                in_no=raw.get("inNo", ""),
                in_date=raw.get("inDate", ""),
                supplier=raw.get("supplier", ""),
                model=raw.get("model", ""),
                imei=raw.get("imei", ""),
                mac=raw.get("mac", ""),
                qty=int(raw.get("qty") or 0),
                stock_qty=int(raw.get("stockQty") or 0),
                receiver=raw.get("receiver", ""),
                remark=raw.get("remark", ""),
            ))
    if db.query(SimStockIn).count() == 0:
        for raw in SIM_STOCK_IN:
            db.add(SimStockIn(
                in_no=raw.get("inNo", ""),
                in_date=raw.get("inDate", ""),
                supplier=raw.get("supplier", ""),
                operator=raw.get("operator", ""),
                iccid=raw.get("iccid", ""),
                qty=int(raw.get("qty") or 0),
                stock_qty=int(raw.get("stockQty") or 0),
                receiver=raw.get("receiver", ""),
                remark=raw.get("remark", ""),
            ))
    if db.query(StockOut).count() == 0:
        for raw in STOCK_OUT:
            db.add(StockOut(
                out_no=raw.get("outNo", ""),
                out_date=raw.get("outDate", ""),
                order_no=raw.get("orderNo", ""),
                store_name=raw.get("storeName", ""),
                customer_name=raw.get("customerName", ""),
                address=raw.get("address", ""),
                model=raw.get("model", ""),
                imei=raw.get("imei", ""),
                mac=raw.get("mac", ""),
                iccid=raw.get("iccid", ""),
                iccid2=raw.get("iccid2", ""),
                operator=raw.get("operator", ""),
                receiver=raw.get("receiver", ""),
                remark=raw.get("remark", ""),
            ))


def _seed_pool_and_contacts(db: Session) -> None:
    if db.query(PublicPoolCustomer).count() == 0:
        for raw in PUBLIC_POOL:
            db.add(PublicPoolCustomer(
                store_name=raw.get("storeName", ""),
                customer_name=raw.get("customerName", ""),
                contact=raw.get("contact", ""),
                phone=raw.get("phone", ""),
                address=raw.get("address", ""),
                source=raw.get("source", "手动"),
                status=raw.get("status", "在公海"),
            ))
    if db.query(Contact).count() == 0:
        for raw in CONTACTS:
            db.add(Contact(
                customer_name=raw.get("customerName", ""),
                store_name=raw.get("storeName", ""),
                name=raw.get("name", ""),
                phone=raw.get("phone", ""),
                title=raw.get("title", ""),
                is_primary=bool(raw.get("isPrimary")),
            ))
    if db.query(ReturnLog).count() == 0:
        for raw in RETURN_LOGS:
            db.add(ReturnLog(
                customer_name=raw.get("customerName", ""),
                store_name=raw.get("storeName", ""),
                sales_name=raw.get("salesName", ""),
                reason=raw.get("reason", ""),
                return_time=raw.get("returnTime", ""),
            ))


def _seed_ledgers(db: Session) -> None:
    if db.query(AccountLedgerEntry).count() == 0:
        for raw in ACCOUNT_LEDGER:
            db.add(AccountLedgerEntry(
                section=raw.get("section", ""),
                direction=raw.get("direction", "in"),
                category=raw.get("category", ""),
                amount=float(raw.get("amount") or 0),
                entry_date=raw.get("entryDate", ""),
                remark_option=raw.get("remarkOption", ""),
                remark=raw.get("remark", ""),
                created_by=raw.get("createdBy", ""),
                create_time=raw.get("createTime", ""),
            ))
    if db.query(AdminLedgerEntry).count() == 0:
        for raw in ADMIN_LEDGER:
            db.add(AdminLedgerEntry(
                category=raw.get("category", ""),
                amount=float(raw.get("amount") or 0),
                entry_date=raw.get("entryDate", ""),
                remark=raw.get("remark", ""),
                created_by=raw.get("createdBy", ""),
                create_time=raw.get("createTime", ""),
            ))


def seed_business_data(db: Session) -> None:
    if db.query(Customer).count() == 0 and db.query(WorkOrder).count() == 0:
        customer_by_order: dict[str, int] = {}
        for raw in CUSTOMERS:
            row = _customer_from_seed(raw)
            db.add(row)
            db.flush()
            if row.order_no:
                customer_by_order[row.order_no] = row.id

        for raw in WORK_ORDERS:
            db.add(_work_order_from_seed(raw, customer_by_order))

    _seed_finance(db)
    _seed_contracts(db)
    _seed_stock(db)
    _seed_pool_and_contacts(db)
    _seed_ledgers(db)
    db.commit()
