from fastapi import APIRouter, Depends

from app.auth.dependencies import require_permission
from app.auth.schemas import TokenPayload

router = APIRouter(prefix="/production", tags=["Production"])


@router.get("/")
async def list_production_orders(
    current_user: TokenPayload = Depends(require_permission("production:read")),
) -> dict:
    # TODO: Phase 2 — implement production queue
    return {"status": "not_implemented", "module": "production"}
