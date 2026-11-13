"""关联导入：日期、状态、金额。不连数据库。"""

from datetime import date, timedelta
from types import SimpleNamespace

from sqlalchemy.exc import IntegrityError

from app.core.exceptions import BizError
from app.services.integrated_service import (
    _assign_payment,
    _contains,
    _display_store_name,
    _format_store_name,
    _import_error_message,
    _match_bill_month,
    _norm_contract_status,
    _norm_date,
    _norm_invoice,
    _norm_payment_status,
    _resolve_amounts,
    _resolve_import_names,
    _resolve_import_sales,
    _same_invoice,
)
from app.utils.contract_status import resolve_contract_status


def check(cond, msg):
    if not cond:
        raise SystemExit(msg)


def test_dates():
    check(_norm_date("45641") == "2024-12-15", _norm_date("45641"))
    check(_norm_date("12/15/24") == "2024-12-15", _norm_date("12/15/24"))
    check(_norm_date("2024/12/15") == "2024-12-15", _norm_date("2024/12/15"))
    check(_norm_date("2024年12月15日") == "2024-12-15", _norm_date("2024年12月15日"))
    check(_norm_date("") == "", "empty date")


def test_status_maps():
    check(_norm_contract_status("30天后到期") == "30天后到期", "30天")
    check(_norm_contract_status("一个月到期") == "30天后到期", "旧一个月")
    check(_norm_contract_status("10天后到期") == "10天后到期", "10天")
    check(_norm_contract_status("3天后到期") == "3天后到期", "3天")
    check(_norm_contract_status("已逾期") == "已逾期", "逾期")
    check(_norm_contract_status("已到期") == "已逾期", "旧已到期")
    check(_norm_contract_status("正常") == "正常", "正常")
    soon = (date.today() + timedelta(days=18)).isoformat()
    past = (date.today() - timedelta(days=1)).isoformat()
    check(resolve_contract_status(soon, "3天后到期") == "30天后到期", "有截止日期按天数")
    check(resolve_contract_status(past, "正常") == "已逾期", "过期")
    check(resolve_contract_status("", "一个月到期") == "30天后到期", "无日期沿用并改口")
    check(_norm_invoice("专票") == "增值税专用发票", "专票")
    check(_norm_invoice("普票") == "增值税普通发票", "普票")
    check(_norm_invoice("专票/普票") == "", "专票/普票不当成开票类型")
    check(_norm_payment_status("已收款") == "已回款", "已收款")
    check(_norm_payment_status("未回款") == "未回款", "未回款")


def test_amounts():
    order = SimpleNamespace(price="100")
    check(
        _resolve_amounts({"price": "1980", "paymentStatus": "已回款"}, order, None)
        == (1980.0, 1980.0, "已回款"),
        "已回款按售价记全额",
    )
    check(
        _resolve_amounts({"price": "1980", "paymentStatus": "未回款"}, order, None)
        == (1980.0, 0.0, "未回款"),
        "未回款已收为 0",
    )
    fin = SimpleNamespace(total_amount=500, paid_amount=200)
    check(
        _resolve_amounts({}, order, fin) == (500.0, 200.0, ""),
        "空行不覆盖原账单",
    )
    check(
        _resolve_amounts({"totalAmount": "800", "paidAmount": "200"}, order, fin)
        == (800.0, 200.0, ""),
        "旧模板应收已收仍可用",
    )
    kept = _resolve_amounts({"price": "1980", "paymentStatus": "未回款"}, order, fin)
    check(kept == (1980.0, 200.0, ""), f"再次导入未回款应保留已收，实际 {kept}")
    fresh = SimpleNamespace(total_amount=500, paid_amount=0)
    check(
        _resolve_amounts({"price": "1980", "paymentStatus": "未回款"}, order, fresh)
        == (1980.0, 0.0, "未回款"),
        "本来就没回款时保持未回款",
    )


def test_assign_payment():
    fin = SimpleNamespace(payment_plan_date="2020-01-01")
    _assign_payment(fin, 0, 0, "未回款", False)
    check(fin.payment_status == "未回款", fin.payment_status)
    check(fin.payment_progress == 0, fin.payment_progress)

    fin = SimpleNamespace(payment_plan_date="2020-01-01")
    _assign_payment(fin, 1980, 0, "未回款", False)
    check(fin.payment_status == "未回款", f"计划日过期仍应保持未回款，实际 {fin.payment_status}")
    check(fin.unpaid_amount == 1980, fin.unpaid_amount)

    fin = SimpleNamespace(payment_plan_date="")
    _assign_payment(fin, 1980, 1980, "已回款", False)
    check(fin.payment_status == "已回款" and fin.payment_progress == 100, "已回款")

    fin = SimpleNamespace(payment_plan_date="")
    _assign_payment(fin, 800, 200, "", True)
    check(fin.payment_status == "部分回款", fin.payment_status)
    check(fin.unpaid_amount == 600, fin.unpaid_amount)


def test_import_sales():
    names = {"张三", "扬琴"}
    check(_resolve_import_sales("张三", names) == "张三", "系统用户原样")
    check(_resolve_import_sales("晏强华", names) == "扬琴", "非系统用户归扬琴")
    check(_resolve_import_sales("杨琴", names) == "扬琴", "杨琴不是扬琴")
    check(_resolve_import_sales("", names) == "扬琴", "空销售归扬琴")
    check(_resolve_import_sales("  扬琴  ", names) == "扬琴", "扬琴本人")


def test_import_error_message():
    check(_import_error_message(BizError("店名为空")) == "店名为空", "业务错误原文")
    exc = IntegrityError("stmt", {}, Exception('duplicate key\nDETAIL:  Key (order_no)=(470) already exists.'))
    check(_import_error_message(exc) == "工单号「470」已存在", _import_error_message(exc))


def test_store_name_compose():
    check(_format_store_name("野人先生（虹口龙之梦）") == "野人先生（虹口龙之梦）", "全角组合保持")
    check(_format_store_name("野人先生(虹口龙之梦)") == "野人先生（虹口龙之梦）", "半角括号统一")
    check(_format_store_name("  欢肆野碗  （龙湖江桥） ") == "欢肆野碗（龙湖江桥）", "括号内空白去掉")
    check(_format_store_name("红渡小香") == "红渡小香", "没有商场名只留门店")
    check(_format_store_name("门店（）") == "门店", "空商场名不算商场")
    check(_format_store_name("（虹口龙之梦）") == "（虹口龙之梦）", "没有门店名称不编造")
    check(_format_store_name("沁雨轩（金地广场店）设备等晏寄回") == "沁雨轩（金地广场店）设备等晏寄回", "括号后还有备注不改写")

    customer, store = _resolve_import_names("野人先生（虹口龙之梦）", "")
    check(store == "野人先生（虹口龙之梦）", f"公司为空也写入组合店名，实际 {store}")
    check(customer == "野人先生", f"公司为空时公司名仍用门店名称，实际 {customer}")
    check("虹口龙之梦" != store, "商场名不能单独当店名")
    customer, store = _resolve_import_names("野人先生(虹口龙之梦)", "")
    check(store == "野人先生（虹口龙之梦）" and customer == "野人先生", "半角同样不拆开")
    customer, store = _resolve_import_names("慈弄（腾飞力达店）", "上海慈弄餐饮有限公司")
    check(customer == "上海慈弄餐饮有限公司" and store == "慈弄（腾飞力达店）", "有公司时店名仍是组合")
    customer, store = _resolve_import_names("红渡小香", "")
    check(customer == "红渡小香" and store == "红渡小香", "没有商场名不拆")
    customer, store = _resolve_import_names("红渡小香", "上海叶环餐饮管理有限公司")
    check(customer == "上海叶环餐饮管理有限公司" and store == "红渡小香", "有公司且无商场名")

    check(
        _display_store_name("河南文昌万达", "野人先生", "", "") == "野人先生（河南文昌万达）",
        "资料不全的历史拆分要合并",
    )
    check(
        _display_store_name("红渡小香", "上海叶环餐饮管理有限公司", "陈素凡", "18717797650") == "红渡小香",
        "公司资料完整时不把公司名当成门店",
    )
    check(
        _display_store_name("厚贞（陆悦天地）", "上海洪旺餐饮企业管理有限公司", "", "") == "厚贞（陆悦天地）",
        "店名里已有商场名就不再拼接",
    )
    check(
        _display_store_name("比星咖啡(周浦万达店)", "黄总", "黄总", "13901048936") == "比星咖啡（周浦万达店）",
        "已组合的店名只统一括号",
    )
    check(_display_store_name("红渡小香", "红渡小香", "", "") == "红渡小香", "没有商场名只显示门店")
    check(_display_store_name("", "野人先生", "", "") == "", "没有门店名称不编造")
    check(
        _display_store_name("沁雨轩（金地广场店）设备等晏寄回", "倒闭", "", "") == "沁雨轩（金地广场店）设备等晏寄回",
        "备注不参与拼接",
    )


def test_filters():
    check(_match_bill_month("2026-01", "6") is False, "6 不应命中 2026 年的其他月")
    check(_match_bill_month("2026-06", "6"), "6 月")
    check(_match_bill_month("2025-06", "06"), "06")
    check(_match_bill_month("2026-12", "12月"), "12月")
    check(_match_bill_month("2026-06", "2026-6"), "2026-6")
    check(_match_bill_month("2025-06", "2026-06") is False, "年份不同")
    check(_match_bill_month("2026-11", "2026"), "只筛年份")
    check(_same_invoice("不开票", "不开发票"), "开票别名")
    check(_same_invoice("增值税专用发票", "不开发票") is False, "开票不串")
    check(_contains("比星咖啡（周浦万达店）", "比星咖啡(周浦万达店)"), "半角括号能搜到全角店名")
    check(_contains("比星咖啡(周浦万达店)", "比星咖啡（周浦万达店）"), "全角括号能搜到半角店名")
    check(_contains("比星咖啡（周浦万达店）", "周浦万达"), "商场名片段仍能搜到")
    check(_contains("回音湖", "比星咖啡(周浦万达店)") is False, "括号兼容不误匹配")


if __name__ == "__main__":
    test_dates()
    test_status_maps()
    test_amounts()
    test_assign_payment()
    test_import_sales()
    test_import_error_message()
    test_store_name_compose()
    test_filters()
    print("python ok")
