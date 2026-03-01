import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.models import AuditLog, Permission, RefreshToken, Role, User, UserRole
from app.auth.schemas import CreateUserRequest, TokenPayload
from app.auth.security import (
    generate_refresh_token,
    get_token_expire_datetime,
    hash_password,
    hash_token,
    verify_password,
)
from app.common.exceptions import BadRequestException, ConflictException, NotFoundException
from app.config import get_settings

settings = get_settings()


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(
        select(User)
        .where(User.username == username)
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )
    return result.scalar_one_or_none()


def collect_user_permissions(user: User) -> list[str]:
    """Collect unique permission codes from all user roles."""
    permissions: set[str] = set()
    for role in user.roles:
        for permission in role.permissions:
            permissions.add(permission.code)
    return sorted(permissions)


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    user = await get_user_by_username(db, username)
    if not user:
        return None
    if not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


async def update_last_login(db: AsyncSession, user: User) -> None:
    user.last_login_at = datetime.now(UTC)
    await db.flush()


async def create_refresh_token_record(
    db: AsyncSession,
    user_id: uuid.UUID,
    ip_address: str | None = None,
    device_info: str | None = None,
) -> str:
    raw_token = generate_refresh_token()
    token_hash = hash_token(raw_token)
    expires_at = get_token_expire_datetime(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    db_token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        ip_address=ip_address,
        device_info=device_info,
        expires_at=expires_at,
    )
    db.add(db_token)
    await db.flush()
    return raw_token


async def validate_and_rotate_refresh_token(
    db: AsyncSession,
    raw_token: str,
    ip_address: str | None = None,
    device_info: str | None = None,
) -> tuple[User, str] | None:
    """
    Validates the refresh token, revokes it, and issues a new one.
    Returns (user, new_raw_token) or None if invalid.
    """
    token_hash = hash_token(raw_token)
    now = datetime.now(UTC)

    result = await db.execute(
        select(RefreshToken)
        .where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .options(selectinload(RefreshToken.user).selectinload(User.roles).selectinload(Role.permissions))
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        return None

    if not token_record.user.is_active:
        return None

    # Revoke old token (rotation)
    token_record.revoked_at = now
    await db.flush()

    # Issue new token
    new_raw_token = await create_refresh_token_record(
        db, token_record.user_id, ip_address, device_info
    )

    return token_record.user, new_raw_token


async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> None:
    token_hash = hash_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    token_record = result.scalar_one_or_none()
    if token_record:
        token_record.revoked_at = datetime.now(UTC)
        await db.flush()


async def log_audit(
    db: AsyncSession,
    action: str,
    status: str,
    user_id: uuid.UUID | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    details: dict | None = None,
) -> None:
    log = AuditLog(
        user_id=user_id,
        action=action,
        status=status,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details,
    )
    db.add(log)
    await db.flush()


# ---- User Management ----

async def create_user(
    db: AsyncSession,
    data: CreateUserRequest,
    created_by_id: uuid.UUID | None = None,
) -> User:
    # Check username uniqueness
    existing = await db.execute(select(User).where(User.username == data.username))
    if existing.scalar_one_or_none():
        raise ConflictException(f"Username '{data.username}' already taken")

    if data.email:
        existing = await db.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none():
            raise ConflictException(f"Email '{data.email}' already registered")

    hashed = hash_password(data.password) if data.password else None

    user = User(
        username=data.username,
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        telegram_id=data.telegram_id,
        hashed_password=hashed,
    )
    db.add(user)
    await db.flush()

    # Assign roles
    if data.role_ids:
        roles_result = await db.execute(
            select(Role).where(Role.id.in_(data.role_ids))
        )
        roles = roles_result.scalars().all()
        for role in roles:
            user_role = UserRole(
                user_id=user.id,
                role_id=role.id,
                assigned_by=created_by_id,
            )
            db.add(user_role)

    await db.flush()

    # Reload with relationships
    return await get_user_by_id(db, user.id)


async def get_all_permissions(db: AsyncSession) -> list[Permission]:
    result = await db.execute(select(Permission).order_by(Permission.module, Permission.code))
    return list(result.scalars().all())


async def get_all_roles(db: AsyncSession) -> list[Role]:
    result = await db.execute(
        select(Role).options(selectinload(Role.permissions)).order_by(Role.name)
    )
    return list(result.scalars().all())


async def get_role_by_id(db: AsyncSession, role_id: uuid.UUID) -> Role | None:
    result = await db.execute(
        select(Role).where(Role.id == role_id).options(selectinload(Role.permissions))
    )
    return result.scalar_one_or_none()


async def update_role_permissions(
    db: AsyncSession,
    role_id: uuid.UUID,
    permission_ids: list[uuid.UUID],
) -> Role:
    """Replace all permissions for a role. Rejects changes to 'owner' role."""
    from app.auth.models import RolePermission
    from app.common.redis_client import get_redis

    role = await get_role_by_id(db, role_id)
    if not role:
        raise NotFoundException(f"Role {role_id} not found")

    if role.name == "owner":
        raise BadRequestException("Cannot modify owner role permissions")

    # Validate permission IDs exist
    if permission_ids:
        result = await db.execute(
            select(Permission.id).where(Permission.id.in_(permission_ids))
        )
        existing_ids = {row[0] for row in result.all()}
        missing = set(permission_ids) - existing_ids
        if missing:
            raise BadRequestException(f"Unknown permission IDs: {missing}")

    # Delete existing role_permissions
    from sqlalchemy import delete
    await db.execute(
        delete(RolePermission).where(RolePermission.role_id == role_id)
    )

    # Insert new
    for pid in permission_ids:
        db.add(RolePermission(role_id=role_id, permission_id=pid))

    await db.flush()

    # Invalidate JWT for all users with this role
    user_result = await db.execute(
        select(UserRole.user_id).where(UserRole.role_id == role_id)
    )
    affected_user_ids = [str(row[0]) for row in user_result.all()]

    if affected_user_ids:
        redis = await get_redis()
        ttl = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        for uid in affected_user_ids:
            await redis.setex(f"revoked:{uid}", ttl, "1")

    # Re-fetch with permissions
    return await get_role_by_id(db, role_id)
