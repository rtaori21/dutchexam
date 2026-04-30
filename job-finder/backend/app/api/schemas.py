from datetime import datetime
from pydantic import BaseModel, ConfigDict


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    external_id: str
    title: str
    company: str
    location: str
    url: str
    description: str
    posted_at: datetime | None
    salary_min: float | None
    salary_max: float | None
    salary_currency: str | None
    is_remote: bool
    seniority: str | None
    job_type: str | None
    match_score: int | None
    match_reasoning: str
    suggested_resume: str | None
    llm_score: int | None
    llm_reasoning: str
    recruiter_emails: str
    recruiter_linkedin: str
    talking_points: str
    recruiter_message: str
    status: str
    notes: str
    discovered_at: datetime
    updated_at: datetime
    alerted_at: datetime | None


class StatusUpdate(BaseModel):
    status: str
    note: str = ""


class NotesUpdate(BaseModel):
    notes: str


class StatsOut(BaseModel):
    total: int
    by_status: dict[str, int]
    new_today: int
    applied_total: int
    avg_score: float | None


class SalaryHistogram(BaseModel):
    currency: str
    buckets: list[dict]  # [{label, count, low, high}]
    median_min: float | None
    median_max: float | None
    sample_size: int


class BundleOut(BaseModel):
    job_id: int
    base_resume_md: str | None
    tailored_resume_md: str | None
    cover_letter_md: str | None
    talking_points_md: str | None
    outreach_md: str | None
    resume_pdf_exists: bool
