from __future__ import annotations

import re

_ROMAN_VALUES = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}

_BAB_NUMBER_RE = re.compile(r"\bbab\s+([0-9]+|[ivxlcdm]+)\b", re.IGNORECASE)


def parse_chapter_token(token: str) -> int | None:
    """Convert an Arabic or Roman numeral token to an int, else None."""
    if not token:
        return None
    if token.isdigit():
        return int(token)
    lowered = token.casefold()
    if not all(ch in _ROMAN_VALUES for ch in lowered):
        return None
    total, previous = 0, 0
    for symbol in reversed(lowered):
        value = _ROMAN_VALUES[symbol]
        total += -value if value < previous else value
        previous = value
    return total


def chapter_number_from_text(text: str) -> int | None:
    """Extract an Arabic or Roman chapter number from a heading like '1. BAB I'."""
    match = _BAB_NUMBER_RE.search(text)
    if match is None:
        return None
    return parse_chapter_token(match.group(1))