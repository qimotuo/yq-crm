from pydantic import BaseModel, Field


class ContractCreateRequest(BaseModel):
    orderNo: str = Field(..., min_length=1)
    customerName: str = Field(..., min_length=1)
    storeName: str = Field(..., min_length=1)
    package: str = ""
    amount: float = Field(..., ge=0)
    startDate: str = Field(..., min_length=1)
    endDate: str = Field(..., min_length=1)
    cityCode: str = "SH"
    status: str = "待生成"
    contractNo: str = ""


class ContractImportRow(BaseModel):
    orderNo: str = Field(..., min_length=1)
    customerName: str = Field(..., min_length=1)
    storeName: str = Field(..., min_length=1)
    package: str = ""
    amount: float = Field(..., ge=0)
    startDate: str = Field(..., min_length=1)
    endDate: str = Field(..., min_length=1)
    cityCode: str = "SH"
    status: str = "待生成"
    contractNo: str = ""


class ContractImportRequest(BaseModel):
    rows: list[ContractImportRow]


class ContractGenerateRequest(BaseModel):
    orderNo: str = Field(..., min_length=1)
