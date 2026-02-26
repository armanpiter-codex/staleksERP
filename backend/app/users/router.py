import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user, require_permission
from app.auth.models import Role, User, UserRole
from app.auth.schemas import (
    AssignRolesRequest,
    CreateUserRequest,
    TokenPayload,
    UpdateUserRequest,
    UserDetailSchema,
)
from app.auth.service import create_user, get_user_by_id
from app.common.exceptions import NotFoundException
from app.common.pagination import PaginatedResponse
from app.database import get_db

router = APIRouter(prefix="/users", tags=["Users"])


# ─── Brief schema for dropdowns ──────────────────────────────────────────────

class UserBriefSchema(BaseModel):
    id: uuid.UUID
    full_name: str
    username: str
    model_config = ConfigDict(from_attributes=True)


# ─── Users by role (for dropdowns: measurers, managers, etc.) ────────────────

@router.get(
    "/by-role",
    response_model=list[UserBriefSchema],
    summary="Список пользователей по роли (для dropdown)",
)
async def get_users_by_role(
    role: str = Query(..., description="Код роли (measurer, foreman, etc.)"),
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserBriefSchema]:
    """Возвращает активных пользователей с заданной ролью.
    Доступно любому авторизованному пользователю (для dropdown-списков).
    """
    result = await db.execute(
        select(User)
        .join(User.roles)
        .where(Role.name == role, User.is_active == True)
        .order_by(User.full_name)
    )
    users = result.scalars().all()
    return [UserBriefSchema.model_validate(u) for u in users]


# ─── List users (admin) ──────────────────────────────────────────────────────

@router.get("/", response_model=PaginatedResponse[UserDetailSchema])
async def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    current_user: TokenPayload = Depends(require_permission("auth:manage_users")),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[UserDetailSchema]:
    query = select(User).options(selectinload(User.roles))

    if search:
        query = query.where(
            User.full_name.ilike(f"%{search}%") | User.username.ilike(f"%{search}%")
        )
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if role:
        query = query.join(User.roles).where(Role.name == role)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    query = query.offset((page - 1) * page_size).limit(page_size).order_by(User.full_name)
    result = await db.execute(query)
    users = result.scalars().all()

    return PaginatedResponse.create(
        items=[UserDetailSchema.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=UserDetailSchema, status_code=201)
async def create_user_endpoint(
    data: CreateUserRequest,
    current_user: TokenPayload = Depends(require_permission("auth:manage_users")),
    db: AsyncSession = Depends(get_db),
) -> UserDetailSchema:
    user = await create_user(db, data, created_by_id=uuid.UUID(current_user.sub))
    return UserDetailSchema.model_validate(user)


@router.get("/{user_id}", response_model=UserDetailSchema)
async def get_user(
    user_id: uuid.UUID,
    current_user: TokenPayload = Depends(require_permission("auth:manage_users")),
    db: AsyncSession = Depends(get_db),
) -> UserDetailSchema:
    user = await get_user_by_id(db, user_id)
    if not user:
        raise NotFoundException(f"User {user_id} not found")
    return UserDetailSchema.model_validate(user)


@router.put("/{user_id}", response_model=UserDetailSchema)
async def update_user(
    user_id: uuid.UUID,
    data: UpdateUserRequest,
    current_user: TokenPayload = Depends(require_permission("auth:manage_users")),
    db: AsyncSession = Depends(get_db),
) -> UserDetailSchema:
    user = await get_user_by_id(db, user_id)
    if not user:
        raise NotFoundException(f"User {user_id} not found")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        user.email = data.email
    if data.phone is not None:
        user.phone = data.phone
    if data.telegram_id is not None:
        user.telegram_id = data.telegram_id
    if data.is_active is not None:
        user.is_active = data.is_active

    await db.flush()
    return UserDetailSchema.model_validate(user)


@router.delete("/{user_id}", status_code=204)
async def deactivate_user(
    user_id: uuid.UUID,
    current_user: TokenPayload = Depends(require_permission("auth:manage_users")),
    db: AsyncSession = Depends(get_db),
) -> None:
    user = await get_user_by_id(db, user_id)
    if not user:
        raise NotFoundException(f"User {user_id} not found")
    # Soft delete
    user.is_active = False
    await db.flush()


@router.post("/{user_id}/roles", response_model=UserDetailSchema)
async def assign_roles(
    user_id: uuid.UUID,
    data: AssignRolesRequest,
    current_user: TokenPayload = Depends(require_permission("auth:manage_roles")),
    db: AsyncSession = Depends(get_db),
) -> UserDetailSchema:
    user = await get_user_by_id(db, user_id)
    if not user:
        raise NotFoundException(f"User {user_id} not found")

    # Remove existing roles
    await db.execute(
        UserRole.__table__.delete().where(UserRole.user_id == user_id)
    )

    # Assign new roles
    roles_result = await db.execute(select(Role).where(Role.id.in_(data.role_ids)))
    roles = roles_result.scalars().all()

    for role in roles:
        user_role = UserRole(
            user_id=user_id,
            role_id=role.id,
            assigned_by=uuid.UUID(current_user.sub),
        )
        db.add(user_role)

    await db.flush()

    # Reload
    user = await get_user_by_id(db, user_id)
    return UserDetailSchema.model_validate(user)
