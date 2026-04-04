"""
VANT Signage Platform — FastAPI Application
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.services.alert_evaluator import run_alert_evaluator_loop
from app.websocket.manager import ws_manager

settings = get_settings()

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("vant")

# ─── Rate limiter ────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)

# ─── App lifecycle ───────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("VANT Signage API starting up")
    evaluator_task = asyncio.create_task(
        run_alert_evaluator_loop(async_session_factory),
        name="alert_evaluator",
    )
    yield
    evaluator_task.cancel()
    try:
        await evaluator_task
    except asyncio.CancelledError:
        pass
    logger.info("VANT Signage API shutting down")


# ─── Create app ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="VANT Signage API",
    description="Digital signage management platform",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── CORS ────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register routes ─────────────────────────────────────────────────────────

from app.api.routes.auth import router as auth_router
from app.api.routes.displays import router as displays_router
from app.api.routes.groups import router as groups_router
from app.api.routes.devices import router as devices_router
from app.api.routes.users import router as users_router
from app.api.routes.storage import router as storage_router
from app.api.routes.media import router as media_router
from app.api.routes.playlists import router as playlists_router
from app.api.routes.schedules import router as schedules_router
from app.api.routes.telemetry import router as telemetry_router
from app.api.routes.alerts import router as alerts_router
from app.api.routes.audit import router as audit_router
from app.websocket.routes import router as ws_router

app.include_router(auth_router)
app.include_router(displays_router)
app.include_router(groups_router)
app.include_router(devices_router)
app.include_router(users_router)
app.include_router(storage_router)
app.include_router(media_router)
app.include_router(playlists_router)
app.include_router(schedules_router)
app.include_router(telemetry_router)
app.include_router(alerts_router)
app.include_router(audit_router)
app.include_router(ws_router)

# ─── Rate limit auth endpoints ───────────────────────────────────────────────


@app.middleware("http")
async def rate_limit_auth(request: Request, call_next):
    """Apply stricter rate limiting to auth endpoints."""
    # slowapi handles global rate limiting via decorator;
    # this middleware is a hook point for future per-endpoint rules
    response = await call_next(request)
    return response


# ─── Health check ────────────────────────────────────────────────────────────


@app.get("/health", tags=["system"])
async def health_check():
    return {
        "status": "healthy",
        "version": "0.1.0",
        "websocket": ws_manager.stats,
    }


# ─── Global error handler ───────────────────────────────────────────────────


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
