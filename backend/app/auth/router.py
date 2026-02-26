from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.dependencies import get_current_user, require_permission
from app.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    PermissionSchema,
    RoleDetailSchema,
    TokenPayload,
    TokenResponse,
    UserMeSchema,
)
from app.auth.security import create_access_token, hash_password, verify_password
from app.common.exceptions import BadRequestException, UnauthorizedException
from app.common.redis_client import get_redis
from app.config import get_settings
from app.database import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])
settings = get_settings()

REFRESH_COOKIE_NAME = "refresh_token"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=any(o.startswith("https") for o in settings.allowed_origins),
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    response: Response,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Rate limiting: 5 attempts per IP per minute
    rate_key = f"rate_limit:login:{ip or 'unknown'}"
    redis_rl = await get_redis()
    attempts = await redis_rl.incr(rate_key)
    if attempts == 1:
        await redis_rl.expire(rate_key, 60)
    if attempts > 5:
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again in 1 minute.")

    user = await service.authenticate_user(db, data.username, data.password)
    if not user:
        await service.log_audit(db, "login", "failure", ip_address=ip, details={"username": data.username})
        raise UnauthorizedException("Invalid username or password")

    await service.update_last_login(db, user)

    roles = [r.name for r in user.roles]
    permissions = service.collect_user_permissions(user)

    access_token = create_access_token(
        user_id=str(user.id),
        username=user.username,
        full_name=user.full_name,
        roles=roles,
        permissions=permissions,
    )

    raw_refresh = await service.create_refresh_token_record(
        db, user.id, ip_address=ip, device_info=user_agent
    )

    await service.log_audit(db, "login", "success", user_id=user.id, ip_address=ip)

    # Clear any revocation from a previous logout so the new token works
    redis = await get_redis()
    await redis.delete(f"revoked:{str(user.id)}")

    _set_refresh_cookie(response, raw_refresh)

    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw_token:
        raise UnauthorizedException("Refresh token not found")

    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    result = await service.validate_and_rotate_refresh_token(
        db, raw_token, ip_address=ip, device_info=user_agent
    )
    if not result:
        _clear_refresh_cookie(response)
        raise UnauthorizedException("Invalid or expired refresh token")

    user, new_raw_refresh = result

    roles = [r.name for r in user.roles]
    permissions = service.collect_user_permissions(user)

    access_token = create_access_token(
        user_id=str(user.id),
        username=user.username,
        full_name=user.full_name,
        roles=roles,
        permissions=permissions,
    )

    _set_refresh_cookie(response, new_raw_refresh)

    return TokenResponse(access_token=access_token)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if raw_token:
        await service.revoke_refresh_token(db, raw_token)

    # Add user to Redis revocation list for the remaining access token TTL
    redis = await get_redis()
    await redis.setex(
        f"revoked:{current_user.sub}",
        settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "1",
    )

    _clear_refresh_cookie(response)
    await service.log_audit(db, "logout", "success", user_id=current_user.sub)

    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserMeSchema)
async def get_me(
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserMeSchema:
    from app.auth.models import User
    user = await service.get_user_by_id(db, current_user.sub)
    if not user:
        raise UnauthorizedException("User not found")

    return UserMeSchema(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        telegram_id=user.telegram_id,
        is_active=user.is_active,
        is_verified=user.is_verified,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        roles=[r for r in user.roles],
        permissions=current_user.permissions,
    )


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await service.get_user_by_id(db, current_user.sub)
    if not user:
        raise UnauthorizedException("User not found")

    if not user.hashed_password or not verify_password(data.current_password, user.hashed_password):
        raise BadRequestException("Current password is incorrect")

    user.hashed_password = hash_password(data.new_password)
    await db.flush()

    return {"message": "Password changed successfully"}


@router.get("/permissions", response_model=list[PermissionSchema])
async def list_permissions(
    current_user: TokenPayload = Depends(require_permission("admin:system")),
    db: AsyncSession = Depends(get_db),
) -> list[PermissionSchema]:
    return await service.get_all_permissions(db)


@router.get("/roles", response_model=list[RoleDetailSchema])
async def list_roles(
    current_user: TokenPayload = Depends(require_permission("auth:manage_roles")),
    db: AsyncSession = Depends(get_db),
) -> list[RoleDetailSchema]:
    return await service.get_all_roles(db)
