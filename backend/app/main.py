import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.common.exceptions import generic_exception_handler, http_exception_handler
from app.common.redis_client import close_redis, get_redis
from app.config import get_settings
from app.database import engine

settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("staleks_erp")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    await close_redis()


app = FastAPI(
    title="Staleks ERP API",
    description="Production management system for Staleks steel door manufacturing",
    version="1.0.0",
    docs_url="/api/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT == "development" else None,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,  # Required for HttpOnly cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)


# Routers
from app.auth.router import router as auth_router  # noqa: E402
from app.users.router import router as users_router  # noqa: E402
from app.orders.router import router as orders_router  # noqa: E402
from app.orders.router import facilities_router  # noqa: E402
from app.services.router import router as service_types_router  # noqa: E402
from app.configurator.router import router as configurator_router  # noqa: E402
from app.production.router import router as production_router  # noqa: E402
from app.feedback.router import router as feedback_router  # noqa: E402

app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(users_router, prefix=settings.API_V1_PREFIX)
app.include_router(orders_router, prefix=settings.API_V1_PREFIX)
app.include_router(facilities_router, prefix=settings.API_V1_PREFIX)
app.include_router(service_types_router, prefix=settings.API_V1_PREFIX)
app.include_router(configurator_router, prefix=settings.API_V1_PREFIX)
app.include_router(production_router, prefix=settings.API_V1_PREFIX)
app.include_router(feedback_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
async def health_check():
    result: dict = {"status": "ok", "environment": settings.ENVIRONMENT}

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        result["database"] = "ok"
    except Exception:
        result["database"] = "error"
        result["status"] = "degraded"

    try:
        redis = await get_redis()
        await redis.ping()
        result["redis"] = "ok"
    except Exception:
        result["redis"] = "error"
        result["status"] = "degraded"

    return result
