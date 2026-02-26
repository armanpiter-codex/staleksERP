"""Service types — Pydantic schemas."""
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.services.models import BillingMethod


class ServiceTypeSchema(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    icon: str | None
    default_price: Decimal
    billing_method: BillingMethod
    is_required: bool
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ServiceTypeCreateSchema(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    icon: str | None = Field(None, max_length=50)
    default_price: Decimal = Field(default=Decimal("0"), ge=0)
    billing_method: BillingMethod = BillingMethod.separate
    is_required: bool = False
    sort_order: int = 0


class ServiceTypeUpdateSchema(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    icon: str | None = Field(None, max_length=50)
    default_price: Decimal | None = Field(None, ge=0)
    billing_method: BillingMethod | None = None
    is_required: bool | None = None
    is_active: bool | None = None
    sort_order: int | None = None
