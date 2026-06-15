from pydantic import BaseModel, Field, field_validator


_OPERATORS = {"中国移动", "中国电信", "中国联通"}


class StockInCreateRequest(BaseModel):
    inDate: str = ""
    supplier: str = Field(..., min_length=1, max_length=64)
    model: str = Field(..., min_length=1, max_length=64)
    imei: str = Field(..., min_length=1, max_length=32)
    mac: str = Field(..., min_length=1, max_length=32)
    qty: int = Field(1, ge=1)
    receiver: str = ""
    remark: str = ""


class StockInUpdateRequest(BaseModel):
    id: int
    inDate: str | None = None
    supplier: str | None = None
    model: str | None = None
    imei: str | None = None
    mac: str | None = None
    qty: int | None = Field(None, ge=1)
    receiver: str | None = None
    remark: str | None = None


class SimStockInCreateRequest(BaseModel):
    inDate: str = ""
    supplier: str = ""
    operator: str = Field(..., min_length=1, max_length=16)
    iccid: str = Field(..., min_length=1, max_length=32)
    qty: int = Field(1, ge=1)
    receiver: str = ""
    remark: str = ""

    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v: str) -> str:
        if v not in _OPERATORS:
            raise ValueError("运营商无效，请选择中国移动/中国电信/中国联通")
        return v


class SimStockInUpdateRequest(BaseModel):
    id: int
    inDate: str | None = None
    supplier: str | None = None
    operator: str | None = None
    iccid: str | None = None
    qty: int | None = Field(None, ge=1)
    receiver: str | None = None
    remark: str | None = None

    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v: str | None) -> str | None:
        if v is not None and v not in _OPERATORS:
            raise ValueError("运营商无效，请选择中国移动/中国电信/中国联通")
        return v


class StockOutCreateRequest(BaseModel):
    outDate: str = ""
    orderNo: str = Field(..., min_length=1, max_length=32)
    model: str = Field(..., min_length=1, max_length=64)
    mac: str = Field(..., min_length=1, max_length=32)
    imei: str = ""
    iccid: str = ""
    iccid2: str = ""
    operator: str = ""
    receiver: str = ""
    remark: str = ""
    storeName: str = ""
    customerName: str = ""
    address: str = ""

    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v: str) -> str:
        if v and v not in _OPERATORS:
            raise ValueError("运营商无效，请选择中国移动/中国电信/中国联通")
        return v

    @field_validator("iccid2")
    @classmethod
    def validate_iccid2(cls, v: str, info) -> str:
        iccid = info.data.get("iccid", "")
        if v and iccid and v == iccid:
            raise ValueError("ICCID2 不能与 ICCID 相同")
        return v


class StockOutImportRow(BaseModel):
    outDate: str = ""
    orderNo: str = Field(..., min_length=1, max_length=32)
    model: str = Field(..., min_length=1, max_length=64)
    mac: str = Field(..., min_length=1, max_length=32)
    imei: str = ""
    iccid: str = ""
    iccid2: str = ""
    operator: str = ""
    receiver: str = ""
    remark: str = ""

    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v: str) -> str:
        if v and v not in _OPERATORS:
            raise ValueError("运营商无效，请选择中国移动/中国电信/中国联通")
        return v


class StockInImportRow(BaseModel):
    inDate: str = ""
    supplier: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    imei: str = Field(..., min_length=1)
    mac: str = Field(..., min_length=1)
    qty: int = Field(1, ge=1)
    receiver: str = ""
    remark: str = ""


class SimStockInImportRow(BaseModel):
    inDate: str = ""
    supplier: str = ""
    operator: str = Field(..., min_length=1)
    iccid: str = Field(..., min_length=1)
    qty: int = Field(1, ge=1)
    receiver: str = ""
    remark: str = ""

    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v: str) -> str:
        if v not in _OPERATORS:
            raise ValueError("运营商无效")
        return v


class StockImportRequest(BaseModel):
    rows: list[dict] = Field(default_factory=list)
