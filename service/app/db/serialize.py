"""业务实体 ORM ↔ API 字典（camelCase）转换"""

from app.db.models import Customer, WorkOrder

_DEVICE_FIELDS = (
    "install_date", "device_supplier", "device_model", "mac", "imei",
    "sim_supplier", "operator", "iccid", "backup_iccid",
)


def work_order_to_dict(order: WorkOrder) -> dict:
    return {
        "id": order.id,
        "orderNo": order.order_no,
        "customerId": order.customer_id,
        "salesName": order.sales_name,
        "storeName": order.store_name,
        "customerName": order.customer_name,
        "address": order.address,
        "contact": order.contact,
        "contactPhone": order.contact_phone,
        "installDate": order.install_date,
        "remark": order.remark,
        "status": order.status,
        "installer": order.installer,
        "deviceSupplier": order.device_supplier,
        "deviceModel": order.device_model,
        "deviceCost": order.device_cost,
        "mac": order.mac,
        "imei": order.imei,
        "simSupplier": order.sim_supplier,
        "operator": order.operator,
        "iccid": order.iccid,
        "backupIccid": order.backup_iccid,
        "installRemark": order.install_remark,
        "installTimeSlot": order.install_time_slot,
        "price": order.price,
        "cardCost": order.card_cost,
        "cardPackage": order.card_package,
        "cardExpireDate": order.card_expire_date,
        "postponeDate": order.postpone_date,
        "failReason": order.fail_reason,
        "installPhotos": list(order.install_photos or []),
        "flowLogs": list(order.flow_logs or []),
    }


def customer_to_dict(customer: Customer) -> dict:
    iccid2 = customer.backup_iccid or ""
    return {
        "id": customer.id,
        "storeName": customer.store_name,
        "customerName": customer.customer_name,
        "contact": customer.contact,
        "phone": customer.phone,
        "address": customer.address,
        "salesName": customer.sales_name,
        "ownerStatus": getattr(customer, "owner_status", None) or "confirmed",
        "ownerNote": getattr(customer, "owner_note", None) or "",
        "contactStatus": customer.contact_status,
        "orderNo": customer.order_no,
        "installDate": customer.install_date,
        "deviceSupplier": customer.device_supplier,
        "deviceModel": customer.device_model,
        "mac": customer.mac,
        "imei": customer.imei,
        "simSupplier": customer.sim_supplier,
        "operator": customer.operator,
        "iccid": customer.iccid,
        "iccid2": iccid2,
        "backupIccid": iccid2,
        "contractPeriod": customer.contract_period,
        "price": customer.price,
        "invoiceType": customer.invoice_type,
        "claimTime": customer.claim_time,
        "lastFollowTime": customer.last_follow_time,
        "wechatId": customer.wechat_id,
        "source": customer.source,
        "idCardFront": customer.id_card_front or "",
        "idCardBack": customer.id_card_back or "",
        "financeId": customer.finance_id,
        "lastPaymentTime": customer.last_payment_time,
        "lastPaymentAmount": customer.last_payment_amount,
    }


def apply_work_order_patch(order: WorkOrder, patch: dict) -> None:
    field_map = {
        "salesName": "sales_name",
        "storeName": "store_name",
        "customerName": "customer_name",
        "customerId": "customer_id",
        "address": "address",
        "contact": "contact",
        "contactPhone": "contact_phone",
        "installDate": "install_date",
        "remark": "remark",
        "status": "status",
        "installer": "installer",
        "deviceSupplier": "device_supplier",
        "deviceModel": "device_model",
        "mac": "mac",
        "imei": "imei",
        "simSupplier": "sim_supplier",
        "operator": "operator",
        "iccid": "iccid",
        "backupIccid": "backup_iccid",
        "installRemark": "install_remark",
        "installTimeSlot": "install_time_slot",
        "price": "price",
        "postponeDate": "postpone_date",
        "failReason": "fail_reason",
        "installPhotos": "install_photos",
    }
    for api_key, attr in field_map.items():
        if api_key in patch:
            setattr(order, attr, patch[api_key])


def device_patch_from_order(order: WorkOrder) -> dict:
    return {
        "orderNo": order.order_no,
        "installDate": order.install_date,
        "deviceSupplier": order.device_supplier,
        "deviceModel": order.device_model,
        "mac": order.mac,
        "imei": order.imei,
        "simSupplier": order.sim_supplier,
        "operator": order.operator,
        "iccid": order.iccid,
        "backupIccid": order.backup_iccid,
    }
