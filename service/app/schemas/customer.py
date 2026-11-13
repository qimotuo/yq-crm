from pydantic import BaseModel, Field


class FollowUpCreateRequest(BaseModel):
    customerId: int = 0
    customerName: str = ""
    storeName: str = ""
    type: str = "电话"
    content: str = Field(..., min_length=1, max_length=512)
    nextPlan: str = ""
    status: str = ""
    salesName: str = ""


class CustomerCreateRequest(BaseModel):
    storeName: str = Field(..., min_length=1, max_length=128)
    customerName: str = Field(..., min_length=1, max_length=128)
    contact: str = ""
    phone: str = ""
    address: str = ""
    salesName: str = ""
    contactStatus: str = "正常"
    orderNo: str = ""
    installDate: str = ""
    deviceSupplier: str = ""
    deviceModel: str = ""
    mac: str = ""
    imei: str = ""
    iccid: str = ""
    iccid2: str = ""
    operator: str = ""
    simSupplier: str = ""
    contractPeriod: str = ""
    price: str = ""
    invoiceType: str = ""
    wechatId: str = ""
    source: str = ""
    idCardFront: str = ""
    idCardBack: str = ""


class CustomerUpdateRequest(BaseModel):
    id: int
    storeName: str | None = None
    customerName: str | None = None
    contact: str | None = None
    phone: str | None = None
    address: str | None = None
    salesName: str | None = None
    contactStatus: str | None = None
    orderNo: str | None = None
    installDate: str | None = None
    deviceSupplier: str | None = None
    deviceModel: str | None = None
    mac: str | None = None
    imei: str | None = None
    iccid: str | None = None
    iccid2: str | None = None
    operator: str | None = None
    simSupplier: str | None = None
    contractPeriod: str | None = None
    price: str | None = None
    invoiceType: str | None = None
    wechatId: str | None = None
    idCardFront: str | None = None
    idCardBack: str | None = None


class CustomerTransferRequest(BaseModel):
    id: int
    salesName: str = Field(..., min_length=1, max_length=64)
    reason: str = ""


class CustomerIdRequest(BaseModel):
    id: int


class CustomerImportRequest(BaseModel):
    rows: list[dict] = Field(default_factory=list)
