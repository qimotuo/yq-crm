from pydantic import BaseModel, Field


class FinanceCreateRequest(BaseModel):
    storeName: str = Field(..., min_length=1)
    customerName: str = Field(..., min_length=1)
    orderNo: str = Field(..., min_length=1)
    package: str = ""
    billMonth: str = ""
    contractPeriod: str = ""
    totalAmount: float = Field(..., ge=0)
    paidAmount: float = Field(0, ge=0)
    paymentPlanDate: str = ""
    salesName: str = ""
    invoiceStatus: str = "待开票"
    contractStatus: str = "正常"


class FinanceUpdateRequest(FinanceCreateRequest):
    id: int


class FinanceImportRow(BaseModel):
    storeName: str = Field(..., min_length=1)
    customerName: str = Field(..., min_length=1)
    orderNo: str = Field(..., min_length=1)
    package: str = ""
    billMonth: str = ""
    contractPeriod: str = ""
    totalAmount: float = Field(..., ge=0)
    paidAmount: float = Field(0, ge=0)
    paymentPlanDate: str = ""
    salesName: str = ""
    invoiceStatus: str = "待开票"


class FinanceImportRequest(BaseModel):
    rows: list[FinanceImportRow]


class FinancePaymentRequest(BaseModel):
    id: int
    paidAmount: float = Field(..., ge=0)
    voucher: str = ""
    verified: bool = False


class FinanceSendBillRequest(BaseModel):
    id: int
    email: str
    customerName: str = ""
