from __future__ import annotations

import pytest

from app.agent.parser import (
    _extract_clear_range,
    _extract_range_anchors,
    _has_page_number_intent,
    _is_add_request,
    _is_clear_request,
    _requested_format,
    _requested_position,
    _requested_start_number,
    _to_chapter_int,
    _try_parse_add_range_request,
)
from app.agent.schemas import DocumentCommand


# ── Intent detection ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "req",
    [
        "tambahkan nomor halaman",
        "hapus nomor halaman",
        "beri nomor halaman romawi kecil",
        "bab 1 sampai bab 3",
        "nomor halaman di kanan bawah",
        "hilangkan penomoran",
        "clear page number",
    ],
)
def test_has_page_number_intent_accepts_page_number_phrasing(req: str):
    assert _has_page_number_intent(req)


@pytest.mark.parametrize(
    "req",
    [
        "halo apa kabar",
        "tolong bersihkan meja",
        "selamat pagi",
        "",
        "kapan jadwal sidang",
    ],
)
def test_has_page_number_intent_rejects_unrelated_text(req: str):
    assert not _has_page_number_intent(req)


def test_is_clear_request_detects_hapus():
    assert _is_clear_request("hapus semua nomor halaman")


def test_is_clear_request_detects_hapus_typo():
    assert _is_clear_request("hapur seluruh nomor halaman")


def test_is_clear_request_detects_hilangkan():
    assert _is_clear_request("hilangkan seluruh nomor halaman")


def test_is_clear_request_rejects_unrelated_hapus_typo():
    assert not _is_clear_request("hapur seluruh meja")


def test_is_clear_request_rejects_add():
    assert not _is_clear_request("tambahkan nomor halaman")


def test_is_add_request_detects_tambahkan():
    assert _is_add_request("tambahkan nomor halaman di kanan bawah")


def test_is_add_request_rejects_clear():
    assert not _is_add_request("hapus nomor halaman")


# ── Clear range extraction ──────────────────────────────────────────


def test_extract_clear_range_bounded():
    page_range = _extract_clear_range("hapus nomor halaman dari bab 1 sampai bab 3")
    assert page_range is not None
    assert page_range.start_anchor == "bab 1"
    assert page_range.end_anchor == "bab 3"
    assert page_range.settings.format == "none"


def test_extract_clear_range_ignores_suffix():
    page_range = _extract_clear_range("hapus nomor halaman dari daftar isi sampai daftar tabel")
    assert page_range is not None
    assert page_range.start_anchor == "daftar isi"
    assert page_range.end_anchor == "daftar tabel"


# ── Position / format / start-number parsing ───────────────────────


@pytest.mark.parametrize(
    ("phrase", "alignment", "position"),
    [
        ("tengah bawah", "center", "bottom"),
        ("bawah tengah", "center", "bottom"),
        ("tengah atas", "center", "top"),
        ("atas tengah", "center", "top"),
        ("kanan bawah", "right", "bottom"),
        ("bawah kanan", "right", "bottom"),
        ("kanan atas", "right", "top"),
        ("atas kanan", "right", "top"),
        ("kiri bawah", "left", "bottom"),
        ("bawah kiri", "left", "bottom"),
        ("kiri atas", "left", "top"),
        ("atas kiri", "left", "top"),
    ],
)
def test_requested_position_combinations(phrase: str, alignment: str, position: str):
    assert _requested_position(phrase, None) == (alignment, position)


def test_requested_position_reverts_to_settings_when_absent():
    class StubSettings:
        alignment = "left"
        position = "top"

    assert _requested_position("nomor halaman", StubSettings()) == ("left", "top")


def test_requested_position_none_if_no_settings():
    assert _requested_position("nomor halaman", None) == (None, None)


@pytest.mark.parametrize(
    ("phrase", "expected"),
    [
        ("romawi besar", "upperRoman"),
        ("romawi kapital", "upperRoman"),
        ("romawi kecil", "lowerRoman"),
        ("romawi", "lowerRoman"),
        ("angka biasa", "decimal"),
        ("angka arab", "decimal"),
        ("angka 1 2 3", "decimal"),
        ("angka", "decimal"),
        ("tanpa nomor", "none"),
        ("tidak ada nomor", "none"),
        ("no page number", "none"),
        ("cetak nomor halaman", None),
    ],
)
def test_requested_format(phrase: str, expected: str | None):
    assert _requested_format(phrase) == expected


def test_requested_start_number():
    assert _requested_start_number("mulai nomor 5") == 5
    assert _requested_start_number("mulai dari nomor 12") == 12
    assert _requested_start_number("nomor halaman biasa") is None


# ── Range anchor extraction ─────────────────────────────────────────


def test_extract_range_anchors_simple():
    start, end = _extract_range_anchors("tambahkan nomor halaman pada bab 1 sampai bab 3")
    assert start == "bab 1"
    assert end == "bab 3"


def test_extract_range_anchors_with_position_words():
    start, end = _extract_range_anchors(
        "tambahkan nomor halaman di kanan bawah pada bab 1 sampai bab 3"
    )
    assert start == "bab 1"
    assert end == "bab 3"


def test_extract_range_anchors_no_sampai():
    assert _extract_range_anchors("tambahkan nomor halaman pada bab 1") == (None, None)


def test_extract_range_anchors_open_ended():
    start, end = _extract_range_anchors("beri nomor dari kata pengantar sampai selesai")
    assert start == "kata pengantar"
    assert end == "selesai"


# ── Chapter number conversion (shared by consolidation) ─────────────


@pytest.mark.parametrize(
    ("token", "expected"),
    [
        ("1", 1),
        ("3", 3),
        ("i", 1),
        ("iii", 3),
        ("iv", 4),
        ("vi", 6),
        ("xii", 12),
        ("III", 3),
        ("IV", 4),
    ],
)
def test_to_chapter_int_valid(token: str, expected: int):
    assert _to_chapter_int(token) == expected


# ── Rule-based add-range parsing (deterministic path) ───────────────


def test_try_parse_add_range_request_open_ended():
    command = _try_parse_add_range_request(
        "tambahkan nomor halaman pada bab 1 sampai selesai",
        "",
    )
    assert command is not None
    assert command.action == "configure_page_number_ranges"
    assert len(command.ranges) == 1
    page_range = command.ranges[0]
    assert page_range.start_anchor == "bab 1"
    assert page_range.end_anchor == "__DOCUMENT_END__"
    assert page_range.settings.position == "bottom"
    assert page_range.settings.alignment == "center"


def test_try_parse_add_range_request_every_chapter_splits_range():
    command = _try_parse_add_range_request(
        "tambahkan nomor halaman di kanan bawah dengan romawi kecil "
        "pada bab 1 sampai bab 3 dengan halaman pertama setiap bab",
        "",
    )
    assert command is not None
    assert command.action == "configure_page_number_ranges"
    assert len(command.ranges) == 3
    anchors = [page_range.start_anchor for page_range in command.ranges]
    assert anchors == ["bab 1", "bab 2", "bab 3"]
    assert command.ranges[0].settings.continue_previous is False
    assert command.ranges[1].settings.continue_previous is True
    assert command.ranges[2].settings.continue_previous is True
    assert command.ranges[0].settings.format == "lowerRoman"
    assert command.ranges[0].settings.alignment == "right"
    assert command.ranges[0].settings.position == "bottom"


def test_try_parse_add_range_request_returns_none_for_gibberish():
    assert _try_parse_add_range_request("buatkan laporan untuk besok pagi", "") is None
    assert _try_parse_add_range_request("halo", "") is None


def test_try_parse_add_range_request_open_ended_setiap_bab_returns_none():
    # The deterministic parser can't know how many chapters exist for an open
    # range, so it must defer to the LLM (returns None).
    command = _try_parse_add_range_request(
        "tambahkan nomor halaman pada bab 1 sampai selesai dengan halaman pertama setiap bab",
        "",
    )
    assert command is None