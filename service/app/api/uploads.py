from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.services import upload_service

router = APIRouter(tags=["文件上传"])


@router.post("/uploads")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    category: str = Form("common"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await upload_service.save_upload(file, category)
    log_action(
        db, user, "upload", "附件",
        f"上传 {result['category']} {result['name']} ({result['size']}B)",
        request=request,
    )
    return ok(result)


@router.delete("/uploads")
def delete_file(
    request: Request,
    path: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = upload_service.delete_upload(path)
    log_action(db, user, "delete", "附件", f"删除附件 {path}", request=request)
    return ok(result)
