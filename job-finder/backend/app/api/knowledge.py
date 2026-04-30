"""Knowledge base API: resumes (filesystem) + projects/cover/Q&A/notes/links (DB).

The user's central place to author and curate every input the LLM uses for
matching and tailoring."""

from __future__ import annotations
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from app.db.session import get_session
from app.db.models import KnowledgeItem
from app.config import settings

router = APIRouter()


# ---- Resumes (filesystem-backed) ----

class ResumeIn(BaseModel):
    body: str


@router.get("/resumes")
def list_resumes():
    out = []
    for p in sorted(settings.resumes_dir.glob("*.md")):
        out.append({
            "filename": p.name,
            "size_bytes": p.stat().st_size,
            "updated_at": datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
        })
    return out


def _safe_resume_path(filename: str) -> Path:
    if "/" in filename or ".." in filename or not filename.endswith(".md"):
        raise HTTPException(400, "filename must be a basename ending in .md")
    return settings.resumes_dir / filename


@router.get("/resumes/{filename}")
def read_resume(filename: str):
    p = _safe_resume_path(filename)
    if not p.exists():
        raise HTTPException(404)
    return {"filename": filename, "body": p.read_text()}


@router.put("/resumes/{filename}")
def write_resume(filename: str, body: ResumeIn):
    p = _safe_resume_path(filename)
    settings.resumes_dir.mkdir(parents=True, exist_ok=True)
    p.write_text(body.body)
    return {"filename": filename, "size_bytes": p.stat().st_size}


@router.delete("/resumes/{filename}")
def delete_resume(filename: str):
    p = _safe_resume_path(filename)
    if not p.exists():
        raise HTTPException(404)
    p.unlink()
    return {"ok": True}


# ---- Knowledge items (DB-backed) ----

KNOWLEDGE_KINDS = {"project", "cover_template", "qa", "note", "link", "summary"}


class ItemIn(BaseModel):
    kind: str
    title: str
    body: str = ""
    url: str = ""
    tags: str = ""
    include_in_llm: bool = True
    sort_order: int = 0


class ItemUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    url: str | None = None
    tags: str | None = None
    include_in_llm: bool | None = None
    sort_order: int | None = None


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: str
    title: str
    body: str
    url: str
    tags: str
    include_in_llm: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


@router.get("/items", response_model=list[ItemOut])
def list_items(kind: str | None = None):
    with get_session() as s:
        q = select(KnowledgeItem)
        if kind:
            q = q.where(KnowledgeItem.kind == kind)
        q = q.order_by(KnowledgeItem.kind.asc(), KnowledgeItem.sort_order.asc(), KnowledgeItem.created_at.asc())
        return list(s.execute(q).scalars())


@router.post("/items", response_model=ItemOut)
def create_item(body: ItemIn):
    if body.kind not in KNOWLEDGE_KINDS:
        raise HTTPException(400, f"kind must be one of {sorted(KNOWLEDGE_KINDS)}")
    with get_session() as s:
        item = KnowledgeItem(**body.model_dump())
        s.add(item)
        s.commit()
        s.refresh(item)
        return item


@router.patch("/items/{item_id}", response_model=ItemOut)
def update_item(item_id: int, body: ItemUpdate):
    with get_session() as s:
        item = s.get(KnowledgeItem, item_id)
        if not item:
            raise HTTPException(404)
        for k, v in body.model_dump(exclude_none=True).items():
            setattr(item, k, v)
        s.commit()
        s.refresh(item)
        return item


@router.delete("/items/{item_id}")
def delete_item(item_id: int):
    with get_session() as s:
        item = s.get(KnowledgeItem, item_id)
        if not item:
            raise HTTPException(404)
        s.delete(item)
        s.commit()
    return {"ok": True}


def collect_llm_context_blocks() -> list[str]:
    """Return knowledge items flagged include_in_llm as cached blocks for LLM tailor/matcher."""
    with get_session() as s:
        items = list(
            s.execute(
                select(KnowledgeItem).where(KnowledgeItem.include_in_llm == True)  # noqa: E712
                .order_by(KnowledgeItem.kind, KnowledgeItem.sort_order)
            ).scalars()
        )
    if not items:
        return []
    by_kind: dict[str, list[KnowledgeItem]] = {}
    for it in items:
        by_kind.setdefault(it.kind, []).append(it)
    blocks: list[str] = []
    for kind, group in by_kind.items():
        body = "\n\n".join(f"### {it.title}\n{it.body}" + (f"\n({it.url})" if it.url else "") for it in group)
        blocks.append(f"## {kind.replace('_', ' ').title()}s\n\n{body}")
    return blocks
