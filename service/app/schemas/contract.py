import re

from pydantic import BaseModel, Field, field_validator

_PHONE = re.compile(r"^1\d{10}$")
_ID_NO = re.compile(r"^\d{17}[\dX]$")


class ContractSignerFields(BaseModel):
    signerName: str = Field(..., min_length=1)
    signerPhone: str
    signerIdNo: str
    signDate: str = Field(..., min_length=1)

    @field_validator("signerName", "signDate")
    @classmethod
    def strip_text(cls, v: str) -> str:
        text = (v or "").strip()
        if not text:
            raise ValueError("不能为空")
        return text

    @field_validator("signerPhone")
    @classmethod
    def check_phone(cls, v: str) -> str:
        text = (v or "").strip()
        if not _PHONE.fullmatch(text):
            raise ValueError("请输入11位手机号")
        return text

    @field_validator("signerIdNo")
    @classmethod
    def check_id_no(cls, v: str) -> str:
        text = (v or "").strip().upper()
        if not _ID_NO.fullmatch(text):
            raise ValueError("请输入18位身份证号")
        return text


_TEMPLATE_KEYS = {"zhilian", "jimi6"}


class ContractOrderLine(BaseModel):
    mallName: str = ""
    deviceType: str = ""
    deviceModel: str = ""
    unitPrice: float | None = None
    contractDate: str = ""


class ContractNetFields(BaseModel):
    salesName: str = ""
    salesPhone: str = ""
    productType: str = ""
    deviceAmount: float | None = None
    partyAddress: str = ""
    partyBank: str = ""
    partyAccount: str = ""
    agentName: str = ""
    agentIdNo: str = ""
    agentTitle: str = ""
    agentPhone: str = ""
    agentEmail: str = ""
    agentAddress: str = ""
    partnerName: str = ""
    partnerIdNo: str = ""
    partnerPhone: str = ""
    partnerSignDate: str = ""
    orderLines: list[ContractOrderLine] = Field(default_factory=list)


class ContractCreateRequest(ContractSignerFields, ContractNetFields):
    templateKey: str = Field(..., min_length=1)
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

    @field_validator("templateKey")
    @classmethod
    def check_template(cls, v: str) -> str:
        key = (v or "").strip()
        if key not in _TEMPLATE_KEYS:
            raise ValueError("请选择合同模板")
        return key


class ContractUpdateRequest(ContractNetFields):
    id: int
    templateKey: str = ""
    orderNo: str = Field(..., min_length=1)
    customerName: str = Field(..., min_length=1)
    storeName: str = Field(..., min_length=1)
    signerName: str = ""
    signerPhone: str = ""
    signerIdNo: str = ""
    signDate: str = ""
    package: str = ""
    amount: float = Field(0, ge=0)
    startDate: str = ""
    endDate: str = ""
    cityCode: str = "SH"
    status: str = "正常"

    @field_validator("templateKey")
    @classmethod
    def check_template(cls, v: str) -> str:
        key = (v or "").strip()
        if key and key not in _TEMPLATE_KEYS:
            raise ValueError("请选择合同模板")
        return key

    @field_validator("signerPhone")
    @classmethod
    def check_phone(cls, v: str) -> str:
        text = (v or "").strip()
        if text and not _PHONE.fullmatch(text):
            raise ValueError("请输入11位手机号")
        return text

    @field_validator("signerIdNo")
    @classmethod
    def check_id_no(cls, v: str) -> str:
        text = (v or "").strip().upper()
        if text and not _ID_NO.fullmatch(text):
            raise ValueError("请输入18位身份证号")
        return text


class ContractImportRow(ContractSignerFields):
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
