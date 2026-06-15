from datetime import date


def calc_payment_status(total_amount: float, paid_amount: float, payment_plan_date: str = "") -> dict:
    unpaid = total_amount - paid_amount
    payment_status = "未回款"
    payment_progress = 0

    if paid_amount >= total_amount:
        payment_status = "已回款"
        payment_progress = 100
    elif paid_amount > 0:
        payment_status = "部分回款"
        payment_progress = round((paid_amount / total_amount) * 100) if total_amount else 0
        if payment_plan_date and date.fromisoformat(payment_plan_date[:10]) < date.today():
            payment_status = "已逾期"
    elif payment_plan_date and date.fromisoformat(payment_plan_date[:10]) < date.today():
        payment_status = "已逾期"

    return {
        "unpaidAmount": unpaid,
        "paymentStatus": payment_status,
        "paymentProgress": payment_progress,
    }
