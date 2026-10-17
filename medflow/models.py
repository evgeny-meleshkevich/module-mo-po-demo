from __future__ import annotations

from datetime import datetime
import re

from pydantic import BaseModel, Field, field_validator
from pydantic_core import PydanticCustomError


class BusinessUnitPreference(BaseModel):
    business_unit_id: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=200)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Укажите корректный email")
        return normalized


class InvitationRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    role: str = Field(pattern="^(user|editor|admin)$")

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return LoginRequest.validate_email(value)


class DocumentRequest(BaseModel):
    full_name: str = Field(min_length=3, max_length=200)
    birth_date: str = Field(min_length=10, max_length=10)
    gender: str = Field(pattern="^(Мужской|Женский)$")
    oms_number: str = Field(default="", max_length=32)
    business_unit_id: str
    structural_unit: str = Field(min_length=1, max_length=500)
    job: str = Field(min_length=1, max_length=500)
    factors: str = Field(min_length=1, max_length=2000)
    po_required: bool
    po_activities: list[str] = []
    document_date: str = Field(min_length=10, max_length=10)
    formats: list[str] = Field(min_length=1)
    bundle_name: str = Field(min_length=1, max_length=120)

    @field_validator("factors", mode="before")
    @classmethod
    def normalize_factors(cls, value: object) -> object:
        # Совместимость с уже открытыми вкладками старой версии интерфейса,
        # которые отправляли выбранные факторы массивом строк.
        if isinstance(value, list):
            return "; ".join(str(item).strip() for item in value if str(item).strip())
        return value

    @field_validator("oms_number")
    @classmethod
    def validate_oms_number(cls, value: str) -> str:
        normalized = re.sub(r"\s+", "", value)
        if normalized and len(normalized) < 8:
            raise ValueError("Номер полиса ОМС должен содержать не менее 8 символов")
        return normalized

    @field_validator("document_date")
    @classmethod
    def validate_document_date(cls, value: str) -> str:
        try:
            datetime.strptime(value, "%d.%m.%Y")
        except ValueError as exc:
            raise PydanticCustomError(
                "invalid_document_date",
                "НЕВЕРНЫЙ ФОРМАТ ДАТЫ",
            ) from exc
        return value

    @field_validator("formats")
    @classmethod
    def validate_formats(cls, values: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(value.lower() for value in values))
        if any(value not in {"xlsx", "pdf"} for value in normalized):
            raise ValueError("Поддерживаются только xlsx и pdf")
        return normalized

    @field_validator("po_activities")
    @classmethod
    def normalize_activities(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(value.strip() for value in values if value.strip()))
