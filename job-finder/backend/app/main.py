"""FastAPI entrypoint. Run with: uvicorn app.main:app --reload --port 8787"""

from __future__ import annotations
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.api.sources import router as sources_router
from app.api.profile import router as profile_router
from app.api.observability import router as observability_router
from app.api.knowledge import router as knowledge_router
from app.api.env_config import router as env_router
from app.db.session import init_db
from app import scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(title="Job Finder", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Permissive in local dev — the API only listens on localhost anyway.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
app.include_router(sources_router, prefix="/api/sources", tags=["sources"])
app.include_router(profile_router, prefix="/api/profile", tags=["profile"])
app.include_router(observability_router, prefix="/api/observability", tags=["observability"])
app.include_router(knowledge_router, prefix="/api/knowledge", tags=["knowledge"])
app.include_router(env_router, prefix="/api/env", tags=["env"])


@app.get("/")
def root():
    return {"app": "job-finder", "docs": "/docs", "api": "/api"}
