from __future__ import annotations

import re

from difflib import SequenceMatcher

from app.agent.chapters import parse_chapter_token
from app.agent.prompts import COMMAND_SYSTEM_PROMPT
from app.agent.schemas import DocumentCommand, FirstPageSettings, PageNumberRange, SectionPageSettings


def create_command_parser(model):
    """Bind the validated command schema to a LangChain chat model."""
    structured_model = model.with_structured_output(DocumentCommand).with_retry(stop_after_attempt=2)

    def parse(
        user_request: str,
        document_context: str,
        previous_prompt: str = "",
        previous_prompts: list[str] | None = None,
        expected_section_count: int | None = None,
    ) -> DocumentCommand:
        # Build message history with optional multi-turn memory (default: last 2 prompts).
        # `previous_prompts` takes precedence; `previous_prompt` kept for backward compat.
        history = previous_prompts if previous_prompts else ([previous_prompt] if previous_prompt else [])
        messages = [("system", COMMAND_SYSTEM_PROMPT)]
        for prior in history[-2:]:
            if prior:
                messages += [
                    ("human", f"[Previous request]\n{prior}"),
                    ("ai", "[Acknowledged. Applying next instruction to same document.]"),
                ]
        messages.append(("human", f"Document context:\n{document_context}\n\nRequest:\n{user_request}"))

        # Reject requests that carry no page-number intent at all (e.g. gibberish
        # or unrelated text). This prevents the small LLM from hallucinating a
        # plausible-looking command out of meaningless input.
        if not _has_page_number_intent(user_request):
            raise ValueError(
                "Maaf, saya tidak memahami permintaan Anda. "
                "Mohon berikan instruksi penomoran halaman yang jelas."
            )

        if _is_clear_request(user_request):
            clear_range = _extract_clear_range(user_request)
            if clear_range is not None:
                return DocumentCommand(
                    action="clear_page_number_ranges",
                    ranges=[clear_range],
                )
            return DocumentCommand(action="clear_all_page_numbers")

        # Try deterministic rule-based parse first (avoids small-model hallucinations).
        rule_based = _try_parse_multi_command(user_request, document_context)
        if rule_based is not None:
            return rule_based

        command = structured_model.invoke(messages)

        # Guard: if LLM returned clear_all_page_numbers but user clearly wanted to ADD,
        # discard the wrong result and fall through to rule-based-only fallback.
        if command.action == "clear_all_page_numbers" and _is_add_request(user_request):
            raise ValueError("Sistem AI gagal memahami struktur dokumen Anda. Cobalah menulis instruksi dengan lebih spesifik, misalnya: 'tambahkan nomor halaman di kanan bawah dari BAB I PENDAHULUAN sampai akhir'.")

        command = _normalize_position_phrases(command, user_request)
        return _add_open_ended_range(command, user_request)

    return parse


def _normalize_position_phrases(command: DocumentCommand, user_request: str) -> DocumentCommand:
    """Make common Indonesian position phrases deterministic for small local models."""
    request = " ".join(user_request.casefold().split())
    normalized_ranges = []
    for page_range in command.ranges:
        range_request = _range_request_segment(request, page_range, command.ranges)
        alignment, position = _requested_position(range_request, page_range.settings)
        settings_update = {}
        if alignment is not None:
            settings_update["alignment"] = alignment
        if position is not None:
            settings_update["position"] = position
        requested_format = _requested_format(range_request)
        if requested_format is not None:
            settings_update["format"] = requested_format
        requested_start_number = _requested_start_number(range_request)
        if requested_start_number is not None:
            settings_update["start_number"] = requested_start_number
        requested_first_page = _requested_first_page(range_request)
        settings_update["first_page"] = (
            FirstPageSettings(**requested_first_page) if requested_first_page is not None else None
        )
        normalized_ranges.append(
            page_range.model_copy(
                update={"settings": page_range.settings.model_copy(update=settings_update)}
            )
        )
    return command.model_copy(update={"ranges": normalized_ranges})


def _requested_position(request: str, settings):
    combinations = (
        ("tengah bawah", "center", "bottom"),
        ("tengah atas", "center", "top"),
        ("bawah tengah", "center", "bottom"),
        ("atas tengah", "center", "top"),
        ("kanan bawah", "right", "bottom"),
        ("kanan atas", "right", "top"),
        ("kiri bawah", "left", "bottom"),
        ("kiri atas", "left", "top"),
        ("bawah kanan", "right", "bottom"),
        ("atas kanan", "right", "top"),
        ("bawah kiri", "left", "bottom"),
        ("atas kiri", "left", "top"),
    )
    for phrase, alignment, position in combinations:
        if phrase in request:
            return alignment, position
    if settings is None:
        return None, None
    return settings.alignment, settings.position


def _requested_format(request: str):
    if any(phrase in request for phrase in ("romawi besar", "romawi kapital")):
        return "upperRoman"
    if any(phrase in request for phrase in ("romawi kecil", "romawi")):
        return "lowerRoman"
    if any(phrase in request for phrase in ("angka biasa", "angka arab", "angka 1 2 3", "angka")):
        return "decimal"
    if any(phrase in request for phrase in ("tanpa nomor", "tidak ada nomor", "no page number")):
        return "none"
    return None


def _requested_start_number(request: str) -> int | None:
    match = re.search(r"mulai\s+(?:dari\s+)?nom(?:or|er)\s+(\d+)", request)
    return int(match.group(1)) if match else None


_PAGE_INTENT_KEYWORDS = (
    # core page-number concepts
    "nomor halaman", "no halaman", "nomor page", "halaman numeral", "penomoran",
    # latin / word for the thing being numbered
    "page number", "page-number",
    # actions
    "hapus", "tambahkan", "tambah", "buat", "buatkan", "pasang", "aktifkan", "gunakan",
    "hilangkan", "hilang", "clear", "remove", "delete",
    # number formats
    "romawi", "romawi kecil", "romawi besar", "romawi kapital", "angka", "decimal",
    # positions / alignments
    "kanan bawah", "kiri bawah", "tengah bawah", "bawah tengah", "bawah kanan", "bawah kiri",
    "kanan atas", "kiri atas", "tengah atas", "atas tengah", "atas kanan", "atas kiri",
    "kanan", "kiri", "tengah", "atas", "bawah",
    # document sections often used as anchors
    "bab", "halaman", "pendahuluan", "tinjauan pustaka", "metode penelitian",
    "lembar pengesahan", "abstrak", "abstract", "daftar", "lampiran", "kesimpulan",
    # range words
    "sampai", "hingga", "selesai", "akhir", "setiap",
    # misc page-number related
    "footer", "header", "nomor", "halaman pertama",
)


def _has_page_number_intent(request: str) -> bool:
    """Return True when the request plausibly concerns page numbering.

    A broad keyword scan guards against feeding gibberish / unrelated text to
    the LLM, which tends to hallucinate a confident-but-wrong command for such
    input. The list is intentionally permissive so valid phrasing is never
    rejected, while pure noise (no overlap) is caught.
    """
    normalized = " ".join(request.casefold().split())
    return any(keyword in normalized for keyword in _PAGE_INTENT_KEYWORDS)


_CLEAR_VERBS = ("hapus", "hilangkan", "remove", "delete", "clear", "bersihkan", "buang")
_CLEAR_NUMBER_MARKERS = (
    "nomor halaman", "nomor page", "no halaman", "page number", "page-number",
    "penomoran", "halaman numeral",
)


def _is_clear_request(request: str) -> bool:
    normalized = " ".join(request.casefold().split())
    if any(
        phrase in normalized
        for phrase in ("hapus semua nomor halaman", "hapus nomor halaman", "hapus page number", "clear all page numbers")
    ):
        return True
    # Typo-tolerant detection (e.g. "hapur seluruh nomor halaman") so common
    # misspellings of "hapus"/"hilangkan"/... still route to the clear path
    # instead of being handed to the LLM, which tends to hallucinate a command.
    has_number_marker = any(marker in normalized for marker in _CLEAR_NUMBER_MARKERS)
    if not has_number_marker:
        return False
    return any(
        SequenceMatcher(None, token, verb).ratio() >= 0.8
        for token in normalized.split()
        for verb in _CLEAR_VERBS
    )


def _extract_clear_range(request: str):
    normalized = " ".join(request.casefold().split())
    match = re.search(r"(?:mulai\s+)?dari\s+(.+?)\s+(?:sampai|hingga)\s+(.+)$", normalized)
    if match is None:
        return None
    return PageNumberRange(
        start_anchor=match.group(1).strip(" .,;:"),
        end_anchor=match.group(2).strip(" .,;:"),
        settings=SectionPageSettings(format="none"),
    )


def _add_open_ended_range(command: DocumentCommand, user_request: str) -> DocumentCommand:
    """Add a range ending at the document end when the model omitted it."""
    request = " ".join(user_request.casefold().split())
    if not any(phrase in request for phrase in ("sampai selesai", "sampai akhir", "hingga akhir")):
        return command
    end_aliases = {"selesai", "akhir", "the end"}
    if any(page_range.end_anchor == "__DOCUMENT_END__" for page_range in command.ranges):
        return command
    if any(page_range.end_anchor.casefold() in end_aliases for page_range in command.ranges):
        return command.model_copy(
            update={
                "ranges": [
                    page_range.model_copy(
                        update={
                            "end_anchor": "__DOCUMENT_END__"
                            if page_range.end_anchor.casefold() in end_aliases
                            else page_range.end_anchor
                        }
                    )
                    for page_range in command.ranges
                ]
            }
        )

    end_match = re.search(r"(?:sampai|hingga)\s+(?:selesai|akhir)", request)
    if end_match is None:
        return command
    preceding_text = request[: end_match.start()]
    start_marker = max(preceding_text.rfind(" dari "), preceding_text.rfind(" mulai dari "))
    if start_marker < 0:
        return command
    start_anchor = preceding_text[start_marker + 1 :].strip()
    if start_anchor.startswith("dari "):
        start_anchor = start_anchor[len("dari ") :]
    if start_anchor.startswith("mulai dari "):
        start_anchor = start_anchor[len("mulai dari ") :]
    range_request = request[start_marker + 1 :]
    settings = SectionPageSettings(
        format=_requested_format(range_request) or "decimal",
        position=_requested_position(range_request, None)[1] or "bottom",
        alignment=_requested_position(range_request, None)[0] or "center",
        continue_previous=False,
        start_number=_requested_start_number(range_request) or 1,
        first_page=(
            FirstPageSettings(**_requested_first_page(range_request))
            if _requested_first_page(range_request) is not None
            else None
        ),
    )
    open_range = PageNumberRange(
        start_anchor=start_anchor,
        end_anchor="__DOCUMENT_END__",
        settings=settings,
    )
    return command.model_copy(update={"ranges": [*command.ranges, open_range]})


def _requested_first_page(request: str):
    """Only enable first-page override when the current range explicitly requests it."""
    marker = next(
        (phrase for phrase in ("halaman pertama", "first page", "odd first page") if phrase in request),
        None,
    )
    if marker is None:
        return None
    first_page_request = request[request.find(marker) :]
    alignment, position = _requested_position(first_page_request, None)
    return {"position": position or "bottom", "alignment": alignment or "center"}


def _range_request_segment(request: str, page_range, ranges) -> str:
    """Extract the clause belonging to one semantic range from a multi-range request."""
    start_anchor = " ".join(page_range.start_anchor.casefold().replace("_", " ").split())
    anchor_index = request.find(start_anchor)
    if anchor_index < 0:
        return request

    other_indices = []
    for other_range in ranges:
        if other_range is page_range:
            continue
        other_anchor = " ".join(other_range.start_anchor.casefold().replace("_", " ").split())
        other_index = request.find(other_anchor)
        if other_index >= 0:
            other_indices.append(other_index)

    previous_indices = [index for index in other_indices if index < anchor_index]
    next_indices = [index for index in other_indices if index > anchor_index]
    start_index = max(previous_indices) if previous_indices else 0
    end_index = min(next_indices) if next_indices else len(request)
    return request[start_index:end_index]


def _is_add_request(request: str) -> bool:
    """Return True when the user clearly wants to ADD page numbers (not remove them)."""
    normalized = " ".join(request.casefold().split())
    add_verbs = ("tambahkan", "tambah", "buat", "buatkan", "pasang", "aktifkan", "gunakan", "add page number")
    return any(verb in normalized for verb in add_verbs)


# ---------------------------------------------------------------------------
# Rule-based range parser (avoids small-LLM hallucinations for common patterns)
# ---------------------------------------------------------------------------

# Pola: "pada/di/dari <start> sampai/hingga <end>"
def _extract_range_anchors(request: str) -> tuple[str, str] | tuple[None, None]:
    """Return (raw_start, raw_end) anchors from a page-number add request.

    Strategy: find the LAST occurrence of 'pada/di/dari' that appears
    before 'sampai/hingga'.  This avoids matching the 'di' in
    'di posisi bawah tengah' when the user later writes 'pada bab 1 ...'
    """
    sampai_match = re.search(r"\b(sampai|hingga)\b", request, re.IGNORECASE)
    if not sampai_match:
        return None, None

    before_sampai = request[: sampai_match.start()]
    after_sampai = request[sampai_match.end() :].strip()

    # Find the LAST preposition before 'sampai'
    last_prep_match = None
    for m in re.finditer(r"\b(pada|dari|di)\b", before_sampai, re.IGNORECASE):
        last_prep_match = m
    if last_prep_match is None:
        return None, None

    raw_start = before_sampai[last_prep_match.end() :].strip().strip(".,;:")

    # End anchor: everything up to the first 'dengan' or end of string
    end_match = re.match(r"(.+?)(?:\s+dengan\b|\s*$)", after_sampai, re.IGNORECASE | re.DOTALL)
    raw_end = (end_match.group(1) if end_match else after_sampai).strip().strip(".,;:")

    return raw_start, raw_end


# Penanda "setiap bab" yang mengharuskan pemisahan range per bab
_SETIAP_BAB = re.compile(r"setiap\s+bab", re.IGNORECASE)

# Pola bab numerik / romawi di dalam anchor
_BAB_IN_ANCHOR = re.compile(
    r"bab\s+(?P<num>[0-9]+|[ivxlcdm]+)(?:\s+(?P<name>[^,;]+?))?(?=\s*$|\s*(?:sampai|hingga|dan|,))",
    re.IGNORECASE,
)


def _to_chapter_int(token: str) -> int | None:
    """Convert an Arabic or Roman numeral chapter token to int (or None)."""
    return parse_chapter_token(token)


_MULTI_COMMAND_CONNECTORS = re.compile(
    r"\s*(?:,\s*)?(?:kemudian|lalu|setelah itu|terus|lantas)\s+",
    re.IGNORECASE,
)


def _split_multi_command(user_request: str) -> list[str]:
    """Split a request like '... kanan, kemudian tambahkan ...' into sub-requests."""
    return [part for part in _MULTI_COMMAND_CONNECTORS.split(user_request) if part.strip()]


def _try_parse_multi_command(user_request: str, document_context: str) -> DocumentCommand | None:
    """Deterministically parse a multi-step add request (e.g. 'romawi ..., kemudian decimal ...').

    Returns a single ``DocumentCommand`` with the merged ranges from every step,
    or ``None`` when any step cannot be parsed by the rule-based parser.
    """
    parts = _split_multi_command(user_request)
    if len(parts) == 1:
        return _try_parse_add_range_request(user_request, document_context)

    commands = []
    for part in parts:
        sub = _try_parse_add_range_request(part, document_context)
        if sub is None or sub.action != "configure_page_number_ranges":
            return None
        commands.append(sub)
    ranges = [page_range for command in commands for page_range in command.ranges]
    return DocumentCommand(action="configure_page_number_ranges", ranges=ranges)


def _try_parse_add_range_request(user_request: str, document_context: str) -> DocumentCommand | None:
    """Attempt a fully deterministic parse of common add-page-number requests.

    Returns a ``DocumentCommand`` when the request matches, or ``None`` so the
    caller can fall through to the LLM.

    Handles:
    * "tambahkan nomor halaman <pos> pada/dari <start> sampai <end>"
    * "... sampai akhir/selesai"
    * "... dengan halaman pertama setiap bab <pos>"  → split one range per chapter
    """
    if not _is_add_request(user_request):
        return None

    request = " ".join(user_request.casefold().split())

    raw_start, raw_end = _extract_range_anchors(request)
    if raw_start is None or raw_end is None:
        return None

    # Normalise "akhir" / "selesai" sentinel
    open_ended = raw_end in ("akhir", "selesai", "the end")
    end_anchor = "__DOCUMENT_END__" if open_ended else raw_end


    # Extract optional font size
    font_size = None
    size_match = re.search(r'(?:ukuran|size)\s+(\d+(?:\.\d+)?)', request, re.IGNORECASE)
    if size_match:
        font_size = float(size_match.group(1))

    # Extract optional font name
    font_name = None
    font_match = re.search(r'(?:font|huruf|jenis font)\s+(arial|times new roman|calibri|cambria|tahoma|verdana|helvetica|georgia|garamond|comic sans ms|trebuchet ms)', request, re.IGNORECASE)
    if font_match:
        # Title case to match standard word fonts
        font_name = font_match.group(1).title()
        if font_name.lower() == "times new roman":
            font_name = "Times New Roman"
        elif font_name.lower() == "comic sans ms":
            font_name = "Comic Sans MS"
        elif font_name.lower() == "trebuchet ms":
            font_name = "Trebuchet MS"

    # Build shared settings from the full request
    alignment, position = _requested_position(request, None)
    fmt = _requested_format(request) or "decimal"
    first_page_raw = _requested_first_page(request)
    first_page = FirstPageSettings(**first_page_raw) if first_page_raw is not None else None

    # Helper to find chapter number from explicit "bab X" or from document context
    def _resolve_chapter(anchor: str) -> int | None:
        match = _BAB_IN_ANCHOR.search(anchor)
        if match:
            return _to_chapter_int(match.group("num"))
        
        normalized = " ".join(anchor.casefold().split())
        words = [w for w in normalized.split() if len(w) > 3]
        
        for line in document_context.splitlines():
            # First try exact match
            if normalized in line.casefold():
                m = _BAB_IN_ANCHOR.search(line)
                if m:
                    return _to_chapter_int(m.group("num"))
                    
            # Fallback: if any significant word matches
            if words and any(w in line.casefold() for w in words):
                m = _BAB_IN_ANCHOR.search(line)
                if m:
                    return _to_chapter_int(m.group("num"))
        return None

    # ------------------------------------------------------------------
    # Case 1: "setiap bab" → emit one range per chapter between start..end
    # Each bab gets its own section; bab 2+ continues numbering from bab 1.
    # ------------------------------------------------------------------
    if _SETIAP_BAB.search(request):
        if open_ended:
            return None  # Let LLM figure out where the document ends and how many chapters there are
            
        n_start = _resolve_chapter(raw_start)
        n_end = _resolve_chapter(raw_end)
        
        # If we can't deterministically find the chapter numbers, fall back to LLM
        if n_start is None or n_end is None:
            return None
            
        if n_start <= n_end:
            ranges = []
            for n in range(n_start, n_end + 1):
                anchor = f"bab {n}"
                is_first = n == n_start
                settings = SectionPageSettings(
                    format=fmt,
                    position=position or "bottom",
                    alignment=alignment or "center",
                    continue_previous=not is_first,
                    start_number=1,
                    first_page=first_page,
                    font_name=font_name,
                    font_size=font_size,
                )
                ranges.append(PageNumberRange(start_anchor=anchor, end_anchor=anchor, settings=settings))
            return DocumentCommand(action="configure_page_number_ranges", ranges=ranges)
        else:
            return None # Reversed range, let LLM handle or fail

    # ------------------------------------------------------------------
    # Case 2: Single range (open-ended or bounded)
    # ------------------------------------------------------------------
    settings = SectionPageSettings(
        format=fmt,
        position=position or "bottom",
        alignment=alignment or "center",
        continue_previous=False,
        start_number=1,
        first_page=first_page,
        font_name=font_name,
        font_size=font_size,
    )
    return DocumentCommand(
        action="configure_page_number_ranges",
        ranges=[
            PageNumberRange(
                start_anchor=raw_start,
                end_anchor=end_anchor,
                settings=settings,
            )
        ],
    )

