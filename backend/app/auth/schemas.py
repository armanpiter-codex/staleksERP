import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ---- Auth ----

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=8)


# ---- Permissions ----

class PermissionSchema(BaseModel):
    id: uuid.UUID
    code: str
    description: str | None
    module: str

    model_config = {"from_attributes": True}


# ---- Roles ----

class RoleSchema(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    description: str | None
    is_system: bool

    model_config = {"from_attributes": True}


class RoleDetailSchema(RoleSchema):
    permissions: list[PermissionSchema] = []

    model_config = {"from_attributes": True}


class CreateRoleRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-z][a-z0-9_]*$")
    display_name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    permission_ids: list[uuid.UUID] = []


class UpdateRoleRequest(BaseModel):
    display_name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = None
    permission_ids: list[uuid.UUID] | None = None


# ---- Users ----

class UserSchema(BaseModel):
    id: uuid.UUID
    username: str
    full_name: str
    email: str | None
    phone: str | None
    telegram_id: int | None
    is_active: bool
    is_verified: bool
    last_login_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserDetailSchema(UserSchema):
    roles: list[RoleSchema] = []

    model_config = {"from_attributes": True}


class UserMeSchema(UserDetailSchema):
    permissions: list[str] = []

    model_config = {"from_attributes": True}


class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100, pattern=r"^[a-zA-Z0-9._-]+$")
    full_name: str = Field(..., min_length=2, max_length=200)
    password: str | None = Field(None, min_length=8)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    telegram_id: int | None = None
    role_ids: list[uuid.UUID] = []


class UpdateUserRequest(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    telegram_id: int | None = None
    is_active: bool | None = None


class AssignRolesRequest(BaseModel):
    role_ids: list[uuid.UUID]


# ---- Token Payload (decoded from JWT) ----

class TokenPayload(BaseModel):
    sub: str  # user_id
    username: str
    full_name: str
    roles: list[str]
    permissions: list[str]
