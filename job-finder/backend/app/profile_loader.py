"""Read + write search_profile.yml (and companies.yml). Atomic write so a crash
during save can't corrupt the file."""

from __future__ import annotations
import os
import tempfile
from threading import RLock
from functools import lru_cache
from pathlib import Path
import yaml
from app.config import settings

_lock = RLock()


@lru_cache(maxsize=1)
def load_profile() -> dict:
    path = settings.config_dir / "search_profile.yml"
    if not path.exists():
        raise FileNotFoundError(f"Search profile missing: {path}")
    with path.open() as f:
        return yaml.safe_load(f)


@lru_cache(maxsize=1)
def load_companies() -> list[dict]:
    path = settings.config_dir / "companies.yml"
    if not path.exists():
        return []
    with path.open() as f:
        data = yaml.safe_load(f) or {}
    return data.get("companies", [])


def reload_all() -> None:
    load_profile.cache_clear()
    load_companies.cache_clear()


# Whitelist of top-level keys the API may patch. Prevents callers from
# overwriting candidate identity or scraper plumbing they didn't intend.
PATCHABLE_KEYS = {
    "location_filter",
    "target_roles",
    "resume_routing",
    "default_resume",
    "filters",
    "scoring",
}
PATCHABLE_NESTED = {
    "scrapers.jobspy.sites",
    "scrapers.jobspy.site_intervals",
    "scrapers.jobspy.search_terms",
    "scrapers.jobspy.countries",
    "scrapers.jobspy.results_wanted",
    "scrapers.jobspy.hours_old",
}


def _set_nested(d: dict, path: str, value):
    keys = path.split(".")
    cur = d
    for k in keys[:-1]:
        cur = cur.setdefault(k, {})
    cur[keys[-1]] = value


def update_profile(patch: dict) -> dict:
    """Merge `patch` into the on-disk profile, validate, write atomically.
    Only whitelisted top-level + nested keys are accepted; anything else is ignored.
    Returns the updated profile dict.
    """
    with _lock:
        path = settings.config_dir / "search_profile.yml"
        with path.open() as f:
            current = yaml.safe_load(f)

        for key, value in patch.items():
            if key in PATCHABLE_KEYS:
                current[key] = value
            elif key in PATCHABLE_NESTED:
                _set_nested(current, key, value)

        # Atomic write
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="w", delete=False, dir=str(path.parent), suffix=".tmp"
        ) as tmp:
            yaml.safe_dump(current, tmp, sort_keys=False, allow_unicode=True)
            tmp_name = tmp.name
        os.replace(tmp_name, path)

        load_profile.cache_clear()
        return current
