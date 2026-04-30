from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings
from app.db.models import Base

_url = settings.resolved_database_url
if _url.startswith("sqlite:///"):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
engine = create_engine(
    _url,
    echo=False,
    connect_args={"check_same_thread": False} if _url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


# Lightweight forward-only column migrations. SQLAlchemy's create_all only
# adds new tables; for existing tables we add missing columns idempotently.
_MIGRATIONS = {
    "jobs": [
        ("llm_score", "INTEGER"),
        ("llm_reasoning", "TEXT DEFAULT ''"),
        ("recruiter_emails", "TEXT DEFAULT ''"),
        ("recruiter_linkedin", "TEXT DEFAULT ''"),
        ("talking_points", "TEXT DEFAULT ''"),
        ("recruiter_message", "TEXT DEFAULT ''"),
        ("canonical_key", "VARCHAR(255) DEFAULT ''"),
    ],
}


def _migrate() -> None:
    insp = inspect(engine)
    # Refresh view in case create_all just added new tables (otherwise has_table is stale)
    insp.clear_cache() if hasattr(insp, "clear_cache") else None
    with engine.begin() as conn:
        for table, cols in _MIGRATIONS.items():
            if not insp.has_table(table):
                continue
            existing = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in cols:
                if name in existing:
                    continue
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def init_db() -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)
    _migrate()


def get_session() -> Session:
    return SessionLocal()
