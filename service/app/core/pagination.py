from app.core.exceptions import BizError

PAGE_SIZE_OPTIONS = (10, 20, 50, 100, 200, 500)


def ensure_page_size(size: int) -> int:
    if size not in PAGE_SIZE_OPTIONS:
        allowed = "、".join(str(n) for n in PAGE_SIZE_OPTIONS)
        raise BizError(f"页大小仅支持 {allowed}")
    return size
