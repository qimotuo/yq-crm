from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    menu_keys: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    operations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    data_scope: Mapped[str] = mapped_column(String(16), nullable=False, default="SELF")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    nickname: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    role_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    gender: Mapped[str] = mapped_column(String(8), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    avatar: Mapped[str] = mapped_column(Text, nullable=False, default="")
    dept_code: Mapped[str] = mapped_column(String(32), nullable=False, default="", index=True)
    wx_open_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    content: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    path: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    template_code: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NotificationBroadcast(Base):
    __tablename__ = "notification_broadcasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sender_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    content: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    type: Mapped[str] = mapped_column(String(16), nullable=False, default="系统")
    path: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    target_type: Mapped[str] = mapped_column(String(16), nullable=False)
    target_roles: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    target_user_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    channels: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    sales_name: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    time: Mapped[str] = mapped_column(String(8), nullable=False, default="09:00")
    type: Mapped[str] = mapped_column(String(16), nullable=False, default="上门")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="待执行")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    store_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    sales_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(16), nullable=False, default="电话")
    content: Mapped[str] = mapped_column(String(512), nullable=False)
    next_plan: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="待完成")
    create_time: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    store_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    contact: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    sales_name: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    owner_status: Mapped[str] = mapped_column(String(16), nullable=False, default="confirmed", index=True)
    owner_note: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    contact_status: Mapped[str] = mapped_column(String(16), nullable=False, default="正常")
    order_no: Mapped[str] = mapped_column(String(32), nullable=False, default="", index=True)
    install_date: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    device_supplier: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    device_model: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    mac: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    imei: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    sim_supplier: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    operator: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    iccid: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    backup_iccid: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    contract_period: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    price: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    device_cost: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    card_cost: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    card_package: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    card_expire_date: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    invoice_type: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    claim_time: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    last_follow_time: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    wechat_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    id_card_front: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    id_card_back: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    finance_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_payment_time: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    last_payment_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_no: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    customer_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    sales_name: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    store_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    contact: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    contact_phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    install_date: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    remark: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="待派工", index=True)
    installer: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    device_supplier: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    device_model: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    mac: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    imei: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    sim_supplier: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    operator: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    iccid: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    backup_iccid: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    install_remark: Mapped[str] = mapped_column(Text, nullable=False, default="")
    install_time_slot: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    price: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    device_cost: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    card_cost: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    card_package: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    card_expire_date: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    postpone_date: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    fail_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    install_photos: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    flow_logs: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    user_name: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    action: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    module: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    detail: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    method: Mapped[str | None] = mapped_column(String(8), nullable=True)
    path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    changes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False, default="新对话")
    context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    thinking: Mapped[str] = mapped_column(Text, nullable=False, default="")
    model: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AppSetting(Base):
    """键值配置（CTI、打印模板等）。"""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Finance(Base):
    """财务账单（含回款记录 JSONB）。"""

    __tablename__ = "finance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    store_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    order_no: Mapped[str] = mapped_column(String(32), nullable=False, default="", index=True)
    package: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    bill_month: Mapped[str] = mapped_column(String(16), nullable=False, default="", index=True)
    contract_period: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    contract_status: Mapped[str] = mapped_column(String(16), nullable=False, default="正常")
    total_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    paid_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    unpaid_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    payment_status: Mapped[str] = mapped_column(String(16), nullable=False, default="未回款", index=True)
    payment_progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    invoice_status: Mapped[str] = mapped_column(String(16), nullable=False, default="待开票")
    sales_name: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    payment_plan_date: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    last_payment_time: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    payment_records: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    contract_no: Mapped[str] = mapped_column(String(32), nullable=False, default="", index=True)
    template_key: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    order_no: Mapped[str] = mapped_column(String(32), nullable=False, default="", index=True)
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    signer_name: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    signer_phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    signer_id_no: Mapped[str] = mapped_column(String(18), nullable=False, default="")
    sign_date: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    store_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    package: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    start_date: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    end_date: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="正常", index=True)
    city_code: Mapped[str] = mapped_column(String(8), nullable=False, default="SH")
    sales_name: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    form_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    doc_path: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    doc_name: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class StockIn(Base):
    """设备入库单。"""

    __tablename__ = "stock_in"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    in_no: Mapped[str] = mapped_column(String(32), nullable=False, default="", index=True)
    in_date: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    supplier: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    model: Mapped[str] = mapped_column(String(64), nullable=False, default="", index=True)
    imei: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    mac: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    store_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    order_no: Mapped[str] = mapped_column(String(32), nullable=False, default="", index=True)
    mobile_no: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    telecom_no: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    replaced_card_no: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stock_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    receiver: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    remark: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SimStockIn(Base):
    """SIM 卡入库单。"""

    __tablename__ = "sim_stock_in"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    in_no: Mapped[str] = mapped_column(String(32), nullable=False, default="", index=True)
    in_date: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    supplier: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    operator: Mapped[str] = mapped_column(String(32), nullable=False, default="", index=True)
    iccid: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stock_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    receiver: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    remark: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StockOut(Base):
    """出库单（关联工单）。"""

    __tablename__ = "stock_out"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    out_no: Mapped[str] = mapped_column(String(32), nullable=False, default="", index=True)
    out_date: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    order_no: Mapped[str] = mapped_column(String(32), nullable=False, default="", index=True)
    store_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    model: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    imei: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    mac: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    iccid: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    iccid2: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    operator: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    mobile_no: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    telecom_no: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    replaced_card_no: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    receiver: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    remark: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PublicPoolCustomer(Base):
    """公海客户。"""

    __tablename__ = "public_pool"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    store_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    contact: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="手动")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="在公海", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Contact(Base):
    """客户联系人。"""

    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False, default="", index=True)
    store_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    name: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    title: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReturnLog(Base):
    """公海退回日志。"""

    __tablename__ = "return_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    store_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    sales_name: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    reason: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    return_time: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AccountLedgerEntry(Base):
    """账户账本。"""

    __tablename__ = "account_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    section: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    direction: Mapped[str] = mapped_column(String(8), nullable=False, default="in")
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    entry_date: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    remark_option: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    remark: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    created_by: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    create_time: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AdminLedgerEntry(Base):
    """行政账本。"""

    __tablename__ = "admin_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    entry_date: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    remark: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    created_by: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    create_time: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CallLog(Base):
    """外呼 / CTI 通话记录。"""

    __tablename__ = "call_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    user_name: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    customer_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    direction: Mapped[str] = mapped_column(String(16), nullable=False, default="outbound")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="calling", index=True)
    duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="softphone")
    provider_ref: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    remark: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
