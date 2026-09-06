import json
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, BackgroundTasks
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.agent.model import create_chat_model
from app.agent.parser import create_command_parser
from app.agent.schemas import DocumentCommand
from app.services.document_service import (
    add_section_breaks_for_command,
    analyze_command,
    apply_command,
    inspect_document,
    open_document,
    export_document,
)
from app.services import preview_storage

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

logger = logging.getLogger("word_world")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Word World API", 
    description="Headless DOCX Page Number Editor API"
)

# Restrict CORS to trusted origins. Override with ALLOWED_ORIGINS (comma-separated)
# for local development, e.g. http://localhost:5173.
_default_origins = ["https://word-world-web.vercel.app"]
_allowed_origins = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", ",".join(_default_origins)).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Word-World-Summary",
        "X-Word-World-Preview",
        "X-Word-World-Preview-Key",
    ],
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "Word World API is running. Ready to process documents."}

@app.delete("/api/v1/preview")
def delete_preview(preview_key: str = Query(..., description="Storage object key to delete")):
    """
    Delete a preview document from Supabase storage.
    Called by the frontend when replacing/clearing a preview (cleanup on new
    process, refresh, or page close). Deleting a non-existent key is a no-op.
    """
    if not preview_key:
        raise HTTPException(status_code=400, detail="preview_key wajib diisi.")
    if not preview_storage.is_configured():
        return {"deleted": False, "reason": "storage_not_configured"}

    ok = preview_storage.delete_object(preview_key)
    return {"deleted": ok}

@app.post("/api/v1/preview/purge")
@app.get("/api/v1/preview/purge")
def purge_previews(max_age_seconds: int | None = Query(default=None)):
    """
    Delete any previews older than the configured TTL (default 3 hours).
    Called by the frontend on startup and can be wired to a cron/keep-alive.
    Safe as a no-op when storage is not configured.
    """
    if not preview_storage.is_configured():
        return {"purged": 0, "reason": "storage_not_configured"}
    purged = preview_storage.purge_old_files(max_age_seconds)
    return {"purged": purged}

@app.post("/api/v1/process-document")
async def process_document(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    previous_prompt: str = Form(default=""),
    previous_prompts: str = Form(default=""),
    output_filename: str = Form(default=""),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """
    Endpoint to receive a DOCX file and a natural language prompt,
    process it with Groq AI, and return the modified DOCX file.
    Optionally accepts `previous_prompt` (the user's last message) or
    `previous_prompts` (a JSON array of prior user messages, max 2) for
    conversational memory — so follow-up corrections work correctly.
    """
    if not file.filename or not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Hanya file .docx yang didukung.")

    # Parse optional JSON history for multi-turn memory (default: last prompt)
    chat_history: list[str] = []
    if previous_prompts:
        try:
            chat_history = json.loads(previous_prompts)
        except (json.JSONDecodeError, TypeError):
            chat_history = []
    if not chat_history and previous_prompt:
        chat_history = [previous_prompt]

    # 1. Read document into memory
    file_bytes = await file.read()

    # Validate file size before any processing
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran file melebihi batas maksimum {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    try:
        document = open_document(file_bytes)
        paragraphs = inspect_document(document)

        # 2. Build context for AI
        # Anchors mostly live in headings, so truncate long body paragraphs and cap
        # the total context to stay within the model's token budget (TPM).
        heading_lines = "\n".join(
            f"[Heading] {item.text[:200]}" for item in paragraphs if "heading" in item.style.casefold()
        )
        body_lines = "\n".join(
            f"[Body] {item.text[:160]}" for item in paragraphs if "heading" not in item.style.casefold()
        )
        if len(heading_lines) > 2000:
            heading_lines = heading_lines[:2000]
        if len(body_lines) > 6000:
            body_lines = body_lines[:6000]
        document_context = (
            f"=== Document Headings ===\n{heading_lines or '(none)'}\n"
            f"\n=== Other paragraphs ===\n{body_lines or '(none)'}\n"
            f"\nsection_count={len(document.sections)}"
        )

        # 3. Ask Groq AI for the configuration command
        #    Pass chat_history for multi-turn conversational memory
        parser = create_command_parser(create_chat_model())
        ai_command = parser(
            prompt,
            document_context,
            previous_prompts=chat_history,
            expected_section_count=len(document.sections),
        )

        # 4. Process the document logic
        command = DocumentCommand.model_validate(ai_command)
        conflicts, _ = analyze_command(document, command)

        if conflicts:
            add_section_breaks_for_command(document, command)

        apply_command(document, command)

        # 5. Export and return the modified file directly
        output_bytes = export_document(document)
        summary = _build_summary(command)

        stem = os.path.splitext(file.filename or "")[0] or "document"
        # Use the frontend-provided versioned name when present, so downloads
        # and previews stay consistent with the chat bubble.
        download_name = (
            output_filename.strip() or f"{stem} - edited"
        )
        if not download_name.lower().endswith(".docx"):
            download_name += ".docx"

        # 6. Upload a copy to Supabase so it can be previewed with Office
        #    Web Viewer. The download below still returns the raw docx so the
        #    client can offer instant .docx download without an extra fetch.
        preview_url = None
        preview_key = None
        if preview_storage.is_configured():
            preview_key = preview_storage.new_preview_key(download_name)
            preview_url = preview_storage.upload_docx(preview_key, output_bytes)
            # Sweep the bucket in the background (TTL = 3h) so orphaned files
            # from crashed sessions are eventually removed without blocking.
            background_tasks.add_task(preview_storage.purge_old_files)

        headers = {
            "Content-Disposition": f'attachment; filename="{download_name}"',
            "X-Word-World-Summary": summary,
        }
        if preview_url:
            headers["X-Word-World-Preview"] = preview_url
        if preview_key:
            headers["X-Word-World-Preview-Key"] = preview_key

        return Response(
            content=output_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers=headers,
        )

    except ValueError as e:
        # Expected/known validation failures (e.g. ambiguous anchor) -> friendly message
        logger.info("Validation error while processing document: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Unexpected failures -> log the real detail server-side, hide it from the client
        logger.exception("Unexpected error while processing document")
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan saat memproses dokumen. Silakan coba lagi.",
        )

def _build_summary(command: DocumentCommand) -> str:
    """Generate a human-readable Indonesian summary of the executed command."""
    if command.action == "clear_all_page_numbers":
        return "Semua nomor halaman berhasil dihapus."

    if command.action == "clear_page_number_ranges":
        parts = []
        for r in command.ranges:
            end = "akhir dokumen" if r.end_anchor == "__DOCUMENT_END__" else r.end_anchor
            parts.append(f"{r.start_anchor} sampai {end}")
        return "Nomor halaman berhasil dihapus dari " + ", dan ".join(parts) + "."

    if command.action == "configure_page_number_ranges":
        fmt_map = {
            "decimal": "angka",
            "lowerRoman": "romawi kecil",
            "upperRoman": "romawi besar",
            "none": "tanpa nomor",
        }
        parts = []
        for r in command.ranges:
            fmt = fmt_map.get(r.settings.format, r.settings.format)
            pos = f"{r.settings.alignment} {r.settings.position}"
            end = "akhir dokumen" if r.end_anchor == "__DOCUMENT_END__" else r.end_anchor
            parts.append(f"{r.start_anchor} s/d {end} ({fmt}, {pos})")
        return "Nomor halaman berhasil dikonfigurasi: " + "; ".join(parts) + "."

    return "Dokumen berhasil diproses."
