"""按空白《网络服务合同》模板生成已填完的 Word，不改原模板。"""

from __future__ import annotations

import copy
import re
import zipfile
from datetime import datetime
from html import escape
from pathlib import Path
from xml.etree import ElementTree as ET

from app.core.exceptions import BizError

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
WT = W + "t"
TEMPLATE = Path(__file__).resolve().parents[1] / "assets" / "templates" / "jimi-net-blank.docx"
PARTY_B = "基米网（上海）科技有限责任公司"
NET_TEMPLATE = "jimi6"

_PHONE = re.compile(r"^1\d{10}$")
_ID_NO = re.compile(r"^\d{17}[\dX]$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_BRACKET_RUN = re.compile(r"^(?:\[[\s\u3000xX]*\]|【[\s\u3000]*】)$")
_PLACEHOLDER = re.compile(
    r"\[[\s\u3000]*\]|\[xxx\]|【[\s\u3000]*】|【[\s\u3000]*\]|【旺铺通/楼宇通】",
    re.IGNORECASE,
)
_CN = "零壹贰叁肆伍陆柒捌玖"
_SEC = ("", "拾", "佰", "仟")
_GRP = ("", "万", "亿", "兆")


def rmb_upper(amount: float) -> str:
    cents = int(round(float(amount) * 100))
    if cents <= 0:
        raise BizError("设备金额需大于 0")
    integer, frac = divmod(cents, 100)
    head = _integer_cn(integer) + "圆"
    if frac == 0:
        return head + "整"
    jiao, fen = divmod(frac, 10)
    if jiao and fen:
        return head + _CN[jiao] + "角" + _CN[fen] + "分"
    if jiao:
        return head + _CN[jiao] + "角"
    return head + "零" + _CN[fen] + "分"


def money_text(amount: float) -> str:
    num = round(float(amount), 2)
    if num == int(num):
        return str(int(num))
    return f"{num:.2f}".rstrip("0").rstrip(".")


def mall_from_store(store: str) -> str:
    text = (store or "").strip()
    matched = re.search(r"[（(]([^（）()]+)[）)]\s*$", text)
    return matched.group(1).strip() if matched else text


def _integer_cn(n: int) -> str:
    if n == 0:
        return "零"
    groups: list[int] = []
    while n > 0:
        groups.append(n % 10000)
        n //= 10000
    chunks: list[str] = []
    for i in range(len(groups) - 1, -1, -1):
        group = groups[i]
        if group == 0:
            chunks.append("零")
            continue
        text = _four_digits(group) + _GRP[i]
        if chunks and chunks[-1] != "零" and group < 1000:
            chunks.append("零")
        chunks.append(text)
    result = "".join(chunks)
    while "零零" in result:
        result = result.replace("零零", "零")
    return result.strip("零")


def _four_digits(n: int) -> str:
    if n <= 0:
        return ""
    digits = f"{n:04d}"
    out: list[str] = []
    zero = False
    for i, ch in enumerate(digits):
        d = int(ch)
        if d == 0:
            zero = True
            continue
        if zero and out:
            out.append("零")
        zero = False
        out.append(_CN[d] + _SEC[3 - i])
    return "".join(out)


def _parse_date(value: str, label: str, errors: list[str]):
    text = (value or "").strip()[:10].replace("/", "-").replace(".", "-")
    if not text:
        errors.append(label)
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        errors.append(f"{label}（格式应为 YYYY-MM-DD）")
        return None


def _need(value: str, label: str, errors: list[str]) -> str:
    text = (value or "").strip()
    if not text:
        errors.append(label)
    return text


def _phone(value: str, label: str, errors: list[str]) -> str:
    text = _need(value, label, errors)
    if text and not _PHONE.fullmatch(text):
        errors.append(f"{label}（需为11位手机号）")
    return text


def _id_no(value: str, label: str, errors: list[str]) -> str:
    text = _need(value, label, errors).upper()
    if text and not _ID_NO.fullmatch(text):
        errors.append(f"{label}（需为18位身份证号）")
    return text


def prepare_net_contract(body: dict) -> dict:
    """校验并整理网络服务合同字段。空的商场名称、订单合同日期按店名和合同日期回填。"""
    errors: list[str] = []
    sign = _parse_date(body.get("signDate", ""), "合同日期", errors)
    start = _parse_date(body.get("startDate", ""), "合同起始日期", errors)
    end = _parse_date(body.get("endDate", ""), "合同结束日期", errors)
    if sign and start and end and start > end:
        errors.append("合同结束日期不能早于起始日期")

    store = _need(body.get("storeName", ""), "店名", errors)
    customer = _need(body.get("customerName", ""), "甲方 / 公司名称", errors)
    signer = _need(body.get("signerName", ""), "合同签署人", errors)
    phone = _phone(body.get("signerPhone", ""), "联系方式", errors)
    id_no = _id_no(body.get("signerIdNo", ""), "身份证号", errors)
    sales = _need(body.get("salesName", ""), "销售", errors)
    sales_phone = _phone(body.get("salesPhone", ""), "销售联系电话", errors)
    product = _need(body.get("productType", ""), "产品类型", errors)
    if product and product not in ("旺铺通", "楼宇通"):
        errors.append("产品类型（只能是旺铺通或楼宇通）")

    party_address = _need(body.get("partyAddress", ""), "甲方地址", errors)
    party_bank = _need(body.get("partyBank", ""), "甲方开户行", errors)
    party_account = _need(body.get("partyAccount", ""), "甲方账号", errors)
    agent_name = _need(body.get("agentName", ""), "经办人姓名", errors)
    agent_id = _id_no(body.get("agentIdNo", ""), "经办人身份证号", errors)
    agent_title = _need(body.get("agentTitle", ""), "经办人职务", errors)
    agent_phone = _phone(body.get("agentPhone", ""), "经办人电话", errors)
    agent_email = _need(body.get("agentEmail", ""), "经办人邮箱", errors)
    if agent_email and not _EMAIL.fullmatch(agent_email):
        errors.append("经办人邮箱（格式不正确）")
    agent_address = _need(body.get("agentAddress", ""), "经办人联系地址", errors)
    partner_name = _need(body.get("partnerName", ""), "合作人姓名", errors)
    partner_id = _id_no(body.get("partnerIdNo", ""), "合作人身份证号", errors)
    partner_phone = _phone(body.get("partnerPhone", ""), "合作人联系电话", errors)
    partner_sign = _parse_date(body.get("partnerSignDate", ""), "附件3签署日期", errors)

    raw_amount = body.get("deviceAmount")
    device_amount = None
    if raw_amount is None or raw_amount == "":
        errors.append("设备金额")
    else:
        try:
            device_amount = round(float(raw_amount), 2)
        except (TypeError, ValueError):
            errors.append("设备金额（需为数字）")
        else:
            if device_amount <= 0:
                errors.append("设备金额（需大于 0）")

    raw_lines = body.get("orderLines") or []
    if not isinstance(raw_lines, list) or not raw_lines:
        errors.append("销售订单明细")
        raw_lines = []

    sign_text = f"{sign.year}年{sign.month}月{sign.day}日" if sign else ""
    mall_default = mall_from_store(store) if store else ""
    lines = []
    total = 0.0
    for idx, raw in enumerate(raw_lines, start=1):
        raw = raw or {}
        mall = (raw.get("mallName") or "").strip() or mall_default
        device_type = (raw.get("deviceType") or "").strip()
        model = (raw.get("deviceModel") or "").strip()
        contract_date = (raw.get("contractDate") or "").strip() or sign_text
        price_raw = raw.get("unitPrice")
        price = None
        if not mall:
            errors.append(f"订单第{idx}行商场名称")
        if not device_type:
            errors.append(f"订单第{idx}行设备类型")
        if not model:
            errors.append(f"订单第{idx}行设备型号")
        if price_raw is None or price_raw == "":
            errors.append(f"订单第{idx}行单价")
        else:
            try:
                price = round(float(price_raw), 2)
            except (TypeError, ValueError):
                errors.append(f"订单第{idx}行单价（需为数字）")
            else:
                if price < 0:
                    errors.append(f"订单第{idx}行单价（不能为负）")
                else:
                    total += price
        if not contract_date:
            errors.append(f"订单第{idx}行合同日期")
        lines.append({
            "mallName": mall,
            "deviceType": device_type,
            "deviceModel": model,
            "unitPrice": price if price is not None else 0,
            "contractDate": contract_date,
        })

    if errors:
        uniq = list(dict.fromkeys(errors))
        raise BizError("请补全后再生成合同：" + "、".join(uniq))

    upper = rmb_upper(device_amount)
    return {
        "signDate": sign.isoformat(),
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "signDateText": sign_text,
        "startYear": str(start.year),
        "startMonth": str(start.month),
        "startDay": str(start.day),
        "endYear": str(end.year),
        "endMonth": str(end.month),
        "endDay": str(end.day),
        "partnerYear": str(partner_sign.year),
        "partnerMonth": str(partner_sign.month),
        "partnerDay": str(partner_sign.day),
        "storeName": store,
        "customerName": customer,
        "signerName": signer,
        "signerPhone": phone,
        "signerIdNo": id_no,
        "salesName": sales,
        "salesPhone": sales_phone,
        "productType": product,
        "partyAddress": party_address,
        "partyBank": party_bank,
        "partyAccount": party_account,
        "agentName": agent_name,
        "agentIdNo": agent_id,
        "agentTitle": agent_title,
        "agentPhone": agent_phone,
        "agentEmail": agent_email,
        "agentAddress": agent_address,
        "partnerName": partner_name,
        "partnerIdNo": partner_id,
        "partnerPhone": partner_phone,
        "partnerSignDate": partner_sign.isoformat(),
        "deviceAmount": device_amount,
        "deviceAmountText": money_text(device_amount),
        "deviceAmountUpper": upper,
        "orderLines": lines,
        "orderTotal": round(total, 2),
        "orderTotalText": money_text(total),
    }


def render_contract_docx(data: dict, dest: Path) -> None:
    if not TEMPLATE.is_file():
        raise BizError("网络服务合同模板不存在")
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp.docx")
    try:
        with zipfile.ZipFile(TEMPLATE, "r") as zin:
            original = zin.read("word/document.xml")
            filled = _fill_document(original, data)
            with zipfile.ZipFile(tmp, "w") as zout:
                for info in zin.infolist():
                    blob = filled if info.filename == "word/document.xml" else zin.read(info.filename)
                    zout.writestr(info, blob)
        text = _document_text(tmp)
        leftover = _PLACEHOLDER.search(text)
        if leftover:
            raise BizError(f"合同仍有未替换占位符：{leftover.group(0)}")
        for fixed in (PARTY_B, "15304484870093", "平安银行上海分行营业部", "上海市嘉定区汇旺东路888号316室"):
            if fixed not in text:
                raise BizError("生成结果缺少乙方固定信息，已中止")
        tmp.replace(dest)
    finally:
        if tmp.exists():
            tmp.unlink()


def docx_to_html(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        root = _parse(zf.read("word/document.xml"))
    body = root.find(f"{W}body")
    parts = ['<div class="net-contract">']
    for child in list(body):
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            text = _plain(child).strip()
            if not text:
                continue
            if text == "网络服务合同":
                parts.append(f"<h2>{escape(text)}</h2>")
            elif text.startswith("附件"):
                parts.append(f"<h3>{escape(text)}</h3>")
            else:
                parts.append(f"<p>{escape(text)}</p>")
        elif tag == "tbl":
            parts.append("<table>")
            for tr in child.findall(f"{W}tr"):
                parts.append("<tr>")
                for tc in tr.findall(f"{W}tc"):
                    span = 1
                    tc_pr = tc.find(f"{W}tcPr")
                    if tc_pr is not None:
                        grid = tc_pr.find(f"{W}gridSpan")
                        if grid is not None and grid.get(f"{W}val"):
                            span = grid.get(f"{W}val")
                    parts.append(f'<td colspan="{span}">{escape(_plain(tc))}</td>')
                parts.append("</tr>")
            parts.append("</table>")
    parts.append("</div>")
    return "".join(parts)


def _document_text(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        root = _parse(zf.read("word/document.xml"))
    return "".join((node.text or "") for node in root.iter(WT))


def _parse(xml: bytes) -> ET.Element:
    head = xml[:8000].decode("utf-8", "ignore")
    for prefix, uri in re.findall(r'xmlns:([A-Za-z0-9]+)="([^"]+)"', head):
        ET.register_namespace(prefix, uri)
    return ET.fromstring(xml)


def _fill_document(original: bytes, data: dict) -> bytes:
    root = _parse(original)
    body = root.find(f"{W}body")
    for child in list(body):
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            _fill_paragraph(child, data)
        elif tag == "tbl":
            _fill_table(child, data)
    out = ET.tostring(root, encoding="utf-8")
    open_tag = re.search(br"<w:document\b[^>]*>", original)
    if open_tag:
        out = re.sub(br"<w:document\b[^>]*>", open_tag.group(0), out, count=1)
    return b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + out


def _plain(el: ET.Element) -> str:
    return "".join((node.text or "") for node in el.iter(WT))


def _take_brackets(el: ET.Element, values: list[str]) -> None:
    nodes = [node for node in el.iter(WT) if node.text and _BRACKET_RUN.fullmatch(node.text)]
    if len(nodes) != len(values):
        raise BizError(f"模板占位与字段数量不一致：{_plain(el)[:40]}")
    for node, value in zip(nodes, values):
        node.text = value


def _append_value(el: ET.Element, value: str) -> None:
    nodes = [node for node in el.iter(WT) if node.text is not None]
    if not nodes:
        raise BizError("模板单元格为空，无法写入")
    nodes[-1].text = (nodes[-1].text or "").rstrip() + value


def _set_cell(tc: ET.Element, value: str) -> None:
    nodes = list(tc.iter(WT))
    if not nodes:
        raise BizError("模板单元格无法写入")
    nodes[0].text = value
    for node in nodes[1:]:
        node.text = ""


def _fill_paragraph(p: ET.Element, data: dict) -> None:
    for node in p.iter(WT):
        if node.text == "【旺铺通/楼宇通】":
            node.text = f"【{data['productType']}】"
    text = _plain(p)
    if "设备价价值" in text:
        _fill_device_sentence(p, data["deviceAmountText"], data["deviceAmountUpper"])
        return
    if "[xxx]" in text.lower():
        for node in p.iter(WT):
            if node.text and "[xxx]" in node.text.lower():
                node.text = re.sub(r"\[xxx\]", data["deviceAmountText"], node.text, flags=re.I)
        return
    if text.startswith("日期") and "店名" in text and "甲方" in text:
        _take_brackets(p, [data["signDateText"], data["storeName"], data["customerName"]])
    elif text.startswith("合同签署人"):
        _take_brackets(p, [data["signerName"], data["signerPhone"], data["signerIdNo"]])
    elif text.startswith("销售"):
        _take_brackets(p, [data["salesName"], data["salesPhone"]])
    elif "有效期为" in text:
        _take_brackets(p, [
            data["startYear"], data["startMonth"], data["startDay"],
            data["endYear"], data["endMonth"], data["endDay"],
        ])
    elif text.startswith("日期") and "乙方（盖章）" in text:
        _take_brackets(p, [data["signDateText"], PARTY_B])
    elif text.startswith("甲方") and "盖章" in text and "乙方" in text:
        _take_brackets(p, [data["customerName"], PARTY_B])
    elif text.count("日期") >= 2:
        _take_brackets(p, [data["signDateText"], data["signDateText"]])
    elif text.startswith("甲方（盖章）") or text.startswith("甲方(盖章)"):
        _take_brackets(p, [data["customerName"]])
    elif text.startswith("日期"):
        _take_brackets(p, [data["signDateText"]])
    elif text.startswith("甲方：") or text.startswith("甲方:"):
        _take_brackets(p, [data["customerName"]])
    elif text.startswith("鉴于"):
        _take_brackets(p, [_year(data), _month(data), _day(data)])
    elif text.startswith("合作人姓名"):
        _take_brackets(p, [data["partnerName"]])
    elif text.startswith("身份证号码"):
        _take_brackets(p, [data["partnerIdNo"]])
    elif text.startswith("联系电话"):
        _take_brackets(p, [data["partnerPhone"]])
    elif text.startswith("签署日期"):
        _take_brackets(p, [data["partnerYear"], data["partnerMonth"], data["partnerDay"]])


def _year(data: dict) -> str:
    return data["signDateText"].split("年", 1)[0]


def _month(data: dict) -> str:
    return data["signDateText"].split("年", 1)[1].split("月", 1)[0]


def _day(data: dict) -> str:
    return data["signDateText"].split("月", 1)[1].replace("日", "")


def _fill_device_sentence(p: ET.Element, amount: str, upper: str) -> None:
    nodes = list(p.iter(WT))
    for i, node in enumerate(nodes):
        if node.text and node.text.endswith("人民币["):
            node.text = node.text[:-1]
            nodes[i + 1].text = amount
            nodes[i + 2].text = nodes[i + 2].text.replace("]元（大写：[", "元（大写：", 1)
            nodes[i + 3].text = upper
            nodes[i + 4].text = nodes[i + 4].text.replace("]圆整", "", 1)
            return
    raise BizError("未找到设备金额占位")


def _fill_table(tbl: ET.Element, data: dict) -> None:
    text = _plain(tbl)
    rows = tbl.findall(f"{W}tr")
    if "甲方经办人信息" in text:
        _fill_agent_table(rows, data)
    elif "销售订单" in text:
        _fill_order_table(tbl, rows, data)


def _cells(tr: ET.Element) -> list[ET.Element]:
    return tr.findall(f"{W}tc")


def _fill_agent_table(rows: list[ET.Element], data: dict) -> None:
    name_row = _cells(rows[1])
    _take_brackets(name_row[0], [data["agentName"]])
    _take_brackets(name_row[1], [data["agentIdNo"]])
    job_row = _cells(rows[2])
    _append_value(job_row[0], data["agentTitle"])
    _take_brackets(job_row[1], [data["agentPhone"]])
    _append_value(job_row[2], data["agentEmail"])
    _append_value(_cells(rows[3])[0], data["agentAddress"])


def _fill_order_table(tbl: ET.Element, rows: list[ET.Element], data: dict) -> None:
    _take_brackets(_cells(rows[2])[0], [data["customerName"]])
    _append_value(_cells(rows[3])[0], data["partyAddress"])
    _take_brackets(_cells(rows[4])[0], [data["signerName"]])
    _take_brackets(_cells(rows[4])[1], [data["salesName"]])
    _take_brackets(_cells(rows[5])[0], [data["signerPhone"]])
    _take_brackets(_cells(rows[5])[1], [data["salesPhone"]])
    _append_value(_cells(rows[6])[0], data["partyBank"])
    _append_value(_cells(rows[7])[0], data["partyAccount"])
    data_row = rows[9]
    total_row = rows[10]
    proto = copy.deepcopy(data_row)
    lines = data["orderLines"]
    _write_line(data_row, 1, lines[0])
    for index, line in enumerate(lines[1:], start=2):
        row = copy.deepcopy(proto)
        _write_line(row, index, line)
        tbl.insert(list(tbl).index(total_row), row)
    _set_cell(_cells(total_row)[1], data["orderTotalText"])


def _write_line(tr: ET.Element, index: int, line: dict) -> None:
    cells = _cells(tr)
    values = [
        str(index),
        line["mallName"],
        line["deviceType"],
        line["deviceModel"],
        money_text(line["unitPrice"]),
        line["contractDate"],
    ]
    for cell, value in zip(cells, values):
        _set_cell(cell, value)
