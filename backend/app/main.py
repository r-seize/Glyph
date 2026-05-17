import os
import logging
import sqlalchemy
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.api.router import router
from app.core.exceptions import GlyphException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_data_dirs()
    _check_db()
    _check_meilisearch()
    yield


def _ensure_data_dirs() -> None:
    for path in [settings.repos_dir, settings.docs_dir, settings.cache_dir]:
        os.makedirs(path, exist_ok=True)
    logger.info(f"Data directory: {settings.data_dir}")


def _check_db() -> None:
    try:
        from app.database import engine
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        logger.info("Database connection OK")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")


def _check_meilisearch() -> None:
    try:
        import meilisearch
        client = meilisearch.Client(settings.meilisearch_url, settings.meilisearch_key)
        client.health()
        logger.info("Meilisearch connection OK")
    except Exception as e:
        logger.warning(f"Meilisearch not available: {e} - search will be degraded")


app = FastAPI(
    title        = "Glyph API",
    description  = "Git-versioned technical documentation",
    version      = "1.0.0",
    lifespan     = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins      = settings.cors_origins,
    allow_credentials  = True,
    allow_methods      = ["*"],
    allow_headers      = ["*"],
)


@app.exception_handler(GlyphException)
async def glyph_exception_handler(request: Request, exc: GlyphException) -> JSONResponse:
    return JSONResponse(
        status_code  = exc.status_code,
        content      = {"detail": exc.message, "code": exc.code},
    )


app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}