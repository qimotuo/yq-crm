from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
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
    role_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
