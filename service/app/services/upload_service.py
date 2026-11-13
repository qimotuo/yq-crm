"""本地文件上传：落盘到 UPLOAD_DIR，通过 /api/files 访问。"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import BizError

CATEGORIES = {"install", "voucher", "idcard", "common"}
_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".bmp"}
_SAFE_NAME_RE = re.compile(r"[^a-zA-Z0-9._\u4e00-\u9fff-]+")


def get_upload_root() -> Path:
    root = Path(settings.upload_dir)
    if not root.is_absolute():
        root = Path.cwd() / root
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def _ext_of(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def _safe_stem(filename: str) -> str:
    stem = Path(filename or "file").stem
    stem = _SAFE_NAME_RE.sub("_", stem).strip("._") or "file"
    return stem[:40]


async def save_upload(file: UploadFile, category: str = "common") -> dict:
    cat = (category or "common").strip().lower()
    if cat not in CATEGORIES:
        raise BizError(f"不支持的上传分类：{category}")
    if not file or not file.filename:
        raise BizError("请选择文件")

    ext = _ext_of(file.filename)
    if ext not in _ALLOWED_EXT:
        raise BizError("仅支持图片或 PDF（jpg/png/gif/webp/pdf）")

    content = await file.read()
    max_bytes = max(1, int(settings.upload_max_mb)) * 1024 * 1024
    if not content:
        raise BizError("文件内容为空")
    if len(content) > max_bytes:
        raise BizError(f"文件不能超过 {settings.upload_max_mb}MB")

    now = datetime.now()
    rel_dir = Path(cat) / f"{now:%Y}" / f"{now:%m}"
    abs_dir = get_upload_root() / rel_dir
    abs_dir.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex[:12]}_{_safe_stem(file.filename)}{ext}"
    abs_path = abs_dir / stored_name
    abs_path.write_bytes(content)

    rel_path = f"{rel_dir.as_posix()}/{stored_name}"
    url = f"{settings.api_prefix}/files/{rel_path}"
    return {
        "url": url,
        "path": rel_path,
        "name": file.filename,
        "size": len(content),
        "category": cat,
        "contentType": file.content_type or "",
    }


def _resolve_upload_path(rel_path: str) -> Path:
    """归一化并校验相对路径，防止越权删除上传目录外的文件。"""
    raw = (rel_path or "").strip().lstrip("/")
    # 兼容传完整 url（…/files/xxx）的情况
    marker = "/files/"
    if marker in raw:
        raw = raw.split(marker, 1)[1]
    if not raw:
        raise BizError("文件路径为空")
    root = get_upload_root()
    abs_path = (root / raw).resolve()
    if not abs_path.is_relative_to(root):
        raise BizError("非法文件路径")
    return abs_path


def delete_upload(rel_path: str) -> dict:
    abs_path = _resolve_upload_path(rel_path)
    if not abs_path.is_file():
        raise BizError("文件不存在或已删除")
    abs_path.unlink()
    return {"deleted": True, "path": rel_path}
