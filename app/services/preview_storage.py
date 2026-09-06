import os
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import httpx

_bucket = os.environ.get("SUPABASE_BUCKET", "previews")

# Maximum age of a preview object before it is considered garbage. Overridable
# for dev, e.g. PREVIEW_MAX_AGE_SECONDS=10800 for 3 hours.
PREVIEW_MAX_AGE_SECONDS = int(os.environ.get("PREVIEW_MAX_AGE_SECONDS", "10800"))


def _created_at_to_dt(value: str) -> datetime | None:
    """Parse a Supabase createdAt ISO-8601 string (handling trailing 'Z')."""
    try:
        normalized = value.rstrip("Z")
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None

# Keep characters that read naturally in a filename (letters, digits, space,
# dots, dashes, underscores, parentheses); replace anything else (e.g. "/")
# with "-". Spaces are fine: they get URL-encoded (%20) in the public URL and
# Office Web Viewer displays them correctly.
_safe_re = re.compile(r"[^A-Za-z0-9 ._()\-]+")


def safe_key(name: str) -> str:
    """A storage key derived from a filename, keeping spaces so the Office
    viewer shows the same readable name as the chat download."""
    base = os.path.splitext(name)[0]  # drop an existing extension
    cleaned = _safe_re.sub("-", base).strip() or "document"
    return cleaned + ".docx"


def new_preview_key(name: str) -> str:
    """A unique storage key per preview so the URL changes every generation.

    The frontend already sends versioned names (e.g. "report edited (2).docx"),
    so consecutive edits already produce distinct URLs. Returning the plain
    URL-safe name keeps the Office viewer's displayed filename consistent with
    the chat download instead of appending a random suffix.
    """
    return safe_key(name)


def _base_url() -> str | None:
    url = os.environ.get("SUPABASE_URL", "").strip()
    return url.rstrip("/") if url else None


def _service_key() -> str | None:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None


def is_configured() -> bool:
    return bool(_base_url() and _service_key())


def build_preview_url(key: str) -> str | None:
    """Public URL string that can be passed to Office Web Viewer."""
    if not _base_url():
        return None
    return f"{_base_url()}/storage/v1/object/public/{_bucket}/{quote(key)}"


def upload_docx(key: str, data: bytes) -> str | None:
    """Upload a docx blob to the public bucket, returning its public URL."""
    if not is_configured():
        return None

    safe = safe_key(key)
    headers = {
        "Authorization": f"Bearer {_service_key()}",
        "Cache-Control": "3600",
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "x-upsert": "true",
    }

    with httpx.Client(timeout=30) as client:
        # POST (with x-upsert) creates/overwrites the object reliably.
        resp = client.post(
            f"{_base_url()}/storage/v1/object/{_bucket}/{quote(safe)}",
            content=data,
            headers=headers,
        )
        if resp.status_code >= 300:
            return None
        return build_preview_url(safe)


def delete_object(key: str) -> bool:
    """Delete a single storage object. Returns True on success (or not configured)."""
    if not is_configured():
        return True

    headers = {"Authorization": f"Bearer {_service_key()}"}

    with httpx.Client(timeout=30) as client:
        # The native DELETE endpoint removes a single object reliably.
        resp = client.delete(
            f"{_base_url()}/storage/v1/object/{_bucket}/{quote(key)}",
            headers=headers,
        )
        return resp.status_code < 300


def list_objects() -> list[dict]:
    """List all objects in the bucket (returns metadata: name, createdAt, ...)."""
    if not is_configured():
        return []

    headers = {"Authorization": f"Bearer {_service_key()}"}

    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{_base_url()}/storage/v1/object/list/{_bucket}",
            json={"prefix": "", "limit": 1000, "offset": 0},
            headers=headers,
        )
        if resp.status_code >= 300:
            return []
        return resp.json() or []


def purge_old_files(max_age_seconds: int | None = None) -> int:
    """Delete objects older than max_age_seconds (default 3 hours).

    Runs on upload, on a purge endpoint (cron), and on client startup so
    orphaned files from crashed sessions never accumulate forever.
    """
    if not is_configured():
        return 0

    max_age = PREVIEW_MAX_AGE_SECONDS if max_age_seconds is None else max_age_seconds
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=max_age)

    deleted = 0
    for obj in list_objects():
        created = _created_at_to_dt(obj.get("created_at") or obj.get("updated_at") or "")
        if created is None:
            continue
        # naive timestamps are UTC in Supabase
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if created < cutoff:
            if delete_object(obj.get("name") or ""):
                deleted += 1
    return deleted
