"""CRUD + manual-trigger API for user-added company career pages."""

from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, HttpUrl
from sqlalchemy import select
from app.db.session import get_session
from app.db.models import CompanySource
from app.scrapers.source_runner import run_one_source, detect_ats

router = APIRouter()


class SourceIn(BaseModel):
    name: str
    url: HttpUrl
    ats: str | None = None
    board_token: str | None = None
    interval_min: int = 15
    enabled: bool = True


class SourceUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    interval_min: int | None = None


class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    url: str
    ats: str
    board_token: str | None
    enabled: bool
    interval_min: int
    last_scraped_at: datetime | None
    last_status: str
    last_error: str
    last_jobs_found: int
    created_at: datetime


@router.get("", response_model=list[SourceOut])
def list_sources():
    with get_session() as s:
        return list(s.execute(select(CompanySource).order_by(CompanySource.created_at.desc())).scalars())


@router.post("", response_model=SourceOut)
def create_source(body: SourceIn):
    url = str(body.url)
    ats = body.ats
    token = body.board_token
    if not ats or not token:
        detected_ats, detected_token = detect_ats(url)
        ats = ats or detected_ats
        token = token or detected_token

    src = CompanySource(
        name=body.name,
        url=url,
        ats=ats,
        board_token=token,
        interval_min=max(5, body.interval_min),
        enabled=body.enabled,
    )
    with get_session() as s:
        s.add(src)
        try:
            s.commit()
        except Exception as e:
            s.rollback()
            raise HTTPException(400, f"Could not create source (URL may already exist): {e}")
        s.refresh(src)
        return src


@router.patch("/{src_id}", response_model=SourceOut)
def update_source(src_id: int, body: SourceUpdate):
    with get_session() as s:
        src = s.get(CompanySource, src_id)
        if not src:
            raise HTTPException(404)
        if body.name is not None:
            src.name = body.name
        if body.enabled is not None:
            src.enabled = body.enabled
        if body.interval_min is not None:
            src.interval_min = max(5, body.interval_min)
        s.commit()
        s.refresh(src)
        return src


@router.delete("/{src_id}")
def delete_source(src_id: int):
    with get_session() as s:
        src = s.get(CompanySource, src_id)
        if not src:
            raise HTTPException(404)
        s.delete(src)
        s.commit()
    return {"ok": True}


@router.post("/{src_id}/scrape")
def scrape_source(src_id: int):
    return run_one_source(src_id)


@router.post("/builtin/{site}/scrape")
def scrape_builtin(site: str):
    """Trigger a JobSpy run scoped to a single built-in site (linkedin/indeed/etc.)."""
    from app.scrapers.runner import run_scrape_pass
    from fastapi import BackgroundTasks  # noqa: F401  — ensure import path resolves

    if site not in {"linkedin", "indeed", "glassdoor", "google", "ziprecruiter"}:
        raise HTTPException(400, "unknown site")
    return run_scrape_pass(sites=[site])
