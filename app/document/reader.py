from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import BinaryIO

from docx import Document


@dataclass(frozen=True)
class ParagraphInfo:
    index: int
    text: str
    style: str
    section_index: int


def load_document(source: bytes | BinaryIO):
    """Load a DOCX from bytes or a binary file-like object."""
    if isinstance(source, bytes):
        source = BytesIO(source)
    return Document(source)


def list_paragraphs(document, include_empty: bool = False) -> list[ParagraphInfo]:
    """Return paragraph metadata while preserving the document's original order."""
    paragraphs = []
    section_index = 0
    for index, paragraph in enumerate(document.paragraphs):
        if include_empty or paragraph.text.strip():
            paragraphs.append(
                ParagraphInfo(
                    index=index,
                    text=paragraph.text,
                    style=paragraph.style.name,
                    section_index=section_index,
                )
            )
        if paragraph._p.pPr is not None and paragraph._p.pPr.sectPr is not None:
            section_index += 1
    return paragraphs
