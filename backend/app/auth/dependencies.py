from collections.abc import Callable

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.schemas import TokenPayload
from app.auth.security import decode_access_token
from app.common.exceptions import ForbiddenException, UnauthorizedException
from app.common.redis_client import get_redis
from app.database import get_db

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> TokenPayload:
    if not credentials:
        raise UnauthorizedException("Bearer token required")

    token = credentials.credentials

    try:
        payload_data = decode_access_token(token)
    except JWTError:
        raise UnauthorizedException("Invalid or expired token")

    user_id = payload_data.get("sub")
    if not user_id:
        raise UnauthorizedException("Invalid token payload")

    # Check Redis revocation list
    redis = await get_redis()
    is_revoked = await redis.get(f"revoked:{user_id}")
    if is_revoked:
        raise UnauthorizedException("Token has been revoked")

    return TokenPayload(
        sub=user_id,
        username=payload_data.get("username", ""),
        full_name=payload_data.get("full_name", ""),
        roles=payload_data.get("roles", []),
        permissions=payload_data.get("permissions", []),
    )


def require_permission(permission_code: str) -> Callable:
    """
    Dependency factory. Usage:
        @router.get("/something")
        async def endpoint(user = Depends(require_permission("orders:read"))):
            ...
    """
    async def dependency(
        current_user: TokenPayload = Depends(get_current_user),
    ) -> TokenPayload:
        if permission_code not in current_user.permissions:
            raise ForbiddenException(f"Permission required: {permission_code}")
        return current_user

    return dependency


def require_any_permission(*permission_codes: str) -> Callable:
    """Grants access if user has ANY of the given permissions."""
    async def dependency(
        current_user: TokenPayload = Depends(get_current_user),
    ) -> TokenPayload:
        if not any(p in current_user.permissions for p in permission_codes):
            raise ForbiddenException(
                f"One of the following permissions required: {', '.join(permission_codes)}"
            )
        return current_user

    return dependency
