"""字段修改对比。"""


def _show(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else str(value)
    return str(value).strip()


def diff_records(before: dict, after: dict, labels: dict[str, str]) -> list[dict]:
    changes = []
    for key, label in labels.items():
        old = _show(before.get(key, ""))
        new = _show(after.get(key, ""))
        if old == new:
            continue
        changes.append({"field": key, "label": label, "before": old, "after": new})
    return changes


CUSTOMER_LABELS = {
    "storeName": "店名",
    "customerName": "客户名称",
    "contact": "联系人",
    "phone": "手机号",
    "address": "地址",
    "salesName": "负责销售",
    "contactStatus": "联系状态",
    "wechatId": "微信号",
    "orderNo": "工单号",
    "installDate": "安装日期",
    "deviceSupplier": "设备供应商",
    "deviceModel": "设备型号",
    "mac": "MAC",
    "imei": "IMEI",
    "iccid": "ICCID",
    "iccid2": "ICCID2",
    "operator": "运营商",
    "simSupplier": "SIM供应商",
    "contractPeriod": "合同周期",
    "price": "价格",
    "invoiceType": "开票类型",
}

WORK_ORDER_LABELS = {
    "storeName": "店名",
    "customerName": "客户名称",
    "address": "安装地址",
    "contact": "联系人",
    "contactPhone": "联系电话",
    "installDate": "预约安装日期",
    "installTimeSlot": "安装时段",
    "remark": "安装备注",
    "price": "价格",
}

FINANCE_LABELS = {
    "storeName": "客户门店",
    "customerName": "客户名称",
    "orderNo": "工单号",
    "package": "合作套餐",
    "billMonth": "账单月份",
    "contractPeriod": "合同周期",
    "totalAmount": "应收总额",
    "paidAmount": "已收金额",
    "unpaidAmount": "未收金额",
    "paymentPlanDate": "回款计划日",
    "salesName": "经办销售",
    "invoiceStatus": "开票状态",
    "paymentStatus": "回款状态",
    "paymentProgress": "回款进度",
}

CONTRACT_LABELS = {
    "templateKey": "合同模板",
    "orderNo": "工单号",
    "customerName": "客户名称",
    "signerName": "签署人",
    "signerPhone": "手机号",
    "signerIdNo": "身份证号",
    "signDate": "签署日期",
    "storeName": "门店",
    "package": "套餐",
    "amount": "金额",
    "startDate": "起始日期",
    "endDate": "截止日期",
    "cityCode": "城市代码",
    "status": "状态",
    "salesName": "销售",
    "salesPhone": "销售联系电话",
    "productType": "产品类型",
    "deviceAmount": "设备金额",
    "partyAddress": "甲方地址",
    "partyBank": "甲方开户行",
    "partyAccount": "甲方账号",
    "agentName": "经办人",
    "agentTitle": "经办人职务",
    "agentPhone": "经办人电话",
    "agentEmail": "经办人邮箱",
    "partnerName": "合作人",
    "orderSummary": "订单明细",
}

INTEGRATED_LABELS = {
    "salesName": "销售姓名",
    "storeName": "店名",
    "customerName": "公司名称",
    "contact": "联系人",
    "phone": "手机号",
    "contactStatus": "联系状态",
    "installer": "安装人",
    "installDate": "安装时间",
    "deviceSupplier": "设备商",
    "deviceModel": "设备型号",
    "deviceCost": "设备成本",
    "mac": "MAC",
    "imei": "IMEI",
    "simSupplier": "卡商",
    "telecomNo": "电信卡号",
    "mobileNo": "移动卡号",
    "oldCardNo": "更换前旧卡号",
    "cardPackage": "卡套餐",
    "cardCost": "卡成本",
    "cardExpireDate": "卡到期日",
    "contractPeriod": "合同周期",
    "billMonth": "账单月",
    "price": "售价",
    "invoiceStatus": "开票",
    "paymentPlanDate": "计划日",
    "totalAmount": "应收",
    "unpaidAmount": "未收",
    "paymentStatus": "回款状态",
    "contractStatus": "合同状态",
    "assetHealth": "资产健康",
}
