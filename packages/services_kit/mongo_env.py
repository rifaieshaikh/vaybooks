"""Resolve Mongo URI / database for non-Streamlit service containers."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Tuple


def _repo_root() -> Path:
    # packages/services_kit/mongo_env.py -> repo root is parents[2]
    return Path(__file__).resolve().parents[2]


def _parse_streamlit_secrets() -> Tuple[str, str]:
    """Read MONGODB_URI / MONGODB_DATABASE from .streamlit/secrets.toml if present."""
    secrets = _repo_root() / ".streamlit" / "secrets.toml"
    if not secrets.is_file():
        return "", ""
    try:
        text = secrets.read_text(encoding="utf-8")
    except OSError:
        return "", ""
    uri = ""
    db = ""
    for key, pattern in (
        ("uri", r'(?im)^\s*MONGODB_URI\s*=\s*"([^"]+)"'),
        ("uri2", r"(?im)^\s*MONGODB_URI\s*=\s*'([^']+)'"),
        ("db", r'(?im)^\s*MONGODB_DATABASE\s*=\s*"([^"]+)"'),
        ("db2", r"(?im)^\s*MONGODB_DATABASE\s*=\s*'([^']+)'"),
        ("db3", r'(?im)^\s*DB_NAME\s*=\s*"([^"]+)"'),
    ):
        m = re.search(pattern, text)
        if not m:
            continue
        if key.startswith("uri") and not uri:
            uri = m.group(1).strip()
        if key.startswith("db") and not db:
            db = m.group(1).strip()
    return uri, db


def mongo_uri() -> str:
    uri = (os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI") or "").strip()
    if uri:
        return uri
    try:
        from vaybooks.bms.infrastructure.config.settings import get_settings

        uri = (get_settings().mongo_uri or "").strip()
        if uri:
            return uri
    except Exception:
        pass
    file_uri, _ = _parse_streamlit_secrets()
    return file_uri


def mongo_db_name() -> str:
    name = (os.environ.get("MONGODB_DATABASE") or os.environ.get("DB_NAME") or "").strip()
    if name:
        return name
    try:
        from vaybooks.bms.infrastructure.config.settings import get_settings

        name = (get_settings().db_name or "").strip()
        if name:
            return name
    except Exception:
        pass
    _, file_db = _parse_streamlit_secrets()
    return file_db or "zahcci_customization"
