from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Text, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


JobStatus = ("new", "approved", "rejected", "applied", "screening", "interview", "offer", "lost")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("source", "external_id", name="uq_source_external"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(50), index=True)  # linkedin, indeed, glassdoor, greenhouse:<co>
    external_id: Mapped[str] = mapped_column(String(255), index=True)
    title: Mapped[str] = mapped_column(String(500))
    company: Mapped[str] = mapped_column(String(255), index=True)
    location: Mapped[str] = mapped_column(String(255), default="")
    url: Mapped[str] = mapped_column(String(1000))
    description: Mapped[str] = mapped_column(Text, default="")
    posted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    salary_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    salary_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    salary_currency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_remote: Mapped[bool] = mapped_column(default=False)
    seniority: Mapped[str | None] = mapped_column(String(100), nullable=True)
    job_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    match_score: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    match_reasoning: Mapped[str] = mapped_column(Text, default="")
    suggested_resume: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # LLM deep score (Phase 5+) — populated by app.matcher.llm
    llm_score: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    llm_reasoning: Mapped[str] = mapped_column(Text, default="")

    # Extracted from JD by parsers
    recruiter_emails: Mapped[str] = mapped_column(Text, default="")  # comma-separated
    recruiter_linkedin: Mapped[str] = mapped_column(Text, default="")  # comma-separated

    # Auto-generated when status moves new -> approved
    talking_points: Mapped[str] = mapped_column(Text, default="")  # bullet markdown
    recruiter_message: Mapped[str] = mapped_column(Text, default="")

    # Cross-source dedupe: derived from normalized (company, title, city)
    canonical_key: Mapped[str] = mapped_column(String(255), default="", index=True)

    status: Mapped[str] = mapped_column(String(30), default="new", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")

    discovered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    alerted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    application: Mapped["Application | None"] = relationship(back_populates="job", uselist=False)


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), unique=True)
    resume_version: Mapped[str] = mapped_column(String(50))
    resume_path: Mapped[str] = mapped_column(String(500), default="")
    cover_letter_path: Mapped[str] = mapped_column(String(500), default="")
    applied_via: Mapped[str] = mapped_column(String(50), default="manual")  # manual, easy_apply, email
    applied_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    response_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")

    job: Mapped["Job"] = relationship(back_populates="application")


class StatusEvent(Base):
    __tablename__ = "status_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    to_status: Mapped[str] = mapped_column(String(30))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ScrapeRun(Base):
    """Per-scrape audit row. Powers the observability page."""
    __tablename__ = "scrape_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # 'jobspy' | 'source' | 'rescrape'
    kind: Mapped[str] = mapped_column(String(30), index=True)
    # Friendly label, e.g. 'LinkedIn+Indeed+Glassdoor', 'greenhouse:adyen'
    label: Mapped[str] = mapped_column(String(255))
    source_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)

    rows_seen: Mapped[int] = mapped_column(Integer, default=0)
    new_jobs: Mapped[int] = mapped_column(Integer, default=0)
    updated_jobs: Mapped[int] = mapped_column(Integer, default=0)
    alerts_sent: Mapped[int] = mapped_column(Integer, default=0)

    status: Mapped[str] = mapped_column(String(20), default="ok")  # ok|error|partial
    error: Mapped[str] = mapped_column(Text, default="")
    breakdown_json: Mapped[str] = mapped_column(Text, default="")  # JSON: per-source counts


class Notification(Base):
    """Audit row for every Telegram/email send. Powers the digest log."""
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    channel: Mapped[str] = mapped_column(String(20), index=True)  # telegram | email
    kind: Mapped[str] = mapped_column(String(30), index=True)  # alert | digest | test
    subject: Mapped[str] = mapped_column(String(500), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="sent")  # sent | failed | skipped
    error: Mapped[str] = mapped_column(Text, default="")
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class KnowledgeItem(Base):
    """User-owned knowledge: projects, cover-letter templates, Q&A, notes,
    profile links. Becomes part of the LLM context for tailoring + matching
    when `include_in_llm` is true.
    """
    __tablename__ = "knowledge_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(30), index=True)
    # project | cover_template | qa | note | link | summary
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(String(1000), default="")
    tags: Mapped[str] = mapped_column(String(500), default="")  # comma-sep
    include_in_llm: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class CompanySource(Base):
    """User-added company career page polled on its own interval."""
    __tablename__ = "company_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(1000), unique=True)
    # Detected/forced ATS type: greenhouse | lever | ashby | workday | smartrecruiters | generic
    ats: Mapped[str] = mapped_column(String(30), default="generic")
    # ATS-specific identifier (e.g. greenhouse board token, lever company slug)
    board_token: Mapped[str | None] = mapped_column(String(255), nullable=True)

    enabled: Mapped[bool] = mapped_column(default=True)
    interval_min: Mapped[int] = mapped_column(Integer, default=15)

    last_scraped_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_status: Mapped[str] = mapped_column(String(20), default="pending")  # ok | error | pending
    last_error: Mapped[str] = mapped_column(Text, default="")
    last_jobs_found: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
