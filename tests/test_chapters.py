from __future__ import annotations

import pytest

from app.agent.chapters import chapter_number_from_text, parse_chapter_token


@pytest.mark.parametrize(
    ("token", "expected"),
    [
        ("1", 1),
        ("3", 3),
        ("12", 12),
        ("i", 1),
        ("iii", 3),
        ("iv", 4),
        ("vi", 6),
        ("ix", 9),
        ("x", 10),
        ("xii", 12),
        ("III", 3),
        ("IV", 4),
        ("XII", 12),
        ("MCMXCIX", 1999),
    ],
)
def test_parse_chapter_token_valid(token: str, expected: int):
    assert parse_chapter_token(token) == expected


@pytest.mark.parametrize(
    "token",
    [
        "",
        "abc",
        "hello",
        "1a",
        "bab",
        " ",
    ],
)
def test_parse_chapter_token_invalid(token: str):
    assert parse_chapter_token(token) is None


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("bab 1", 1),
        ("bab 2", 2),
        ("bab iii", 3),
        ("bab xii", 12),
        ("1. BAB I", 1),
        ("bab iv pendahuluan", 4),
        ("babbab", None),
        ("kata pengantar", None),
        ("pendahuluan", None),
        ("berbab 5", None),
        ("", None),
    ],
)
def test_chapter_number_from_text(text: str, expected: int | None):
    assert chapter_number_from_text(text) == expected