from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class SectionPageSettings(BaseModel):
    format: Literal["none", "decimal", "lowerRoman", "upperRoman"] = "none"
    position: Literal["top", "bottom"] = "bottom"
    alignment: Literal["left", "center", "right"] = "center"
    continue_previous: bool = False
    start_number: int = Field(default=1, ge=1)
    first_page: "FirstPageSettings | None" = None
    font_name: str | None = Field(default=None, description="Explicit font name requested by user (e.g. 'Arial' or 'Times New Roman'). Null if not requested.")
    font_size: float | None = Field(default=None, description="Explicit font size requested by user (e.g. 11 or 12). Null if not requested.")


class FirstPageSettings(BaseModel):
    show: bool = Field(True, description="Set to false if the first page should NOT have a page number (e.g. 'halaman pertama dikecualikan/dihilangkan/tanpa halaman').")
    position: Literal["top", "bottom"] = "bottom"
    alignment: Literal["left", "center", "right"] = "center"


class PageNumberRange(BaseModel):
    start_anchor: str = Field(description="First section anchor text")
    end_anchor: str = Field(description="Last section anchor text, or __DOCUMENT_END__ for sampai selesai")
    settings: SectionPageSettings


class DocumentCommand(BaseModel):
    action: Literal[
        "configure_page_number_ranges",
        "clear_all_page_numbers",
        "clear_page_number_ranges",
    ]
    ranges: list[PageNumberRange] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_action_fields(self) -> "DocumentCommand":
        if self.action == "configure_page_number_ranges" and not self.ranges:
            raise ValueError("configure_page_number_ranges requires at least one range")
        if self.action == "clear_all_page_numbers" and self.ranges:
            raise ValueError("clear_all_page_numbers cannot include ranges")
        if self.action == "clear_page_number_ranges" and not self.ranges:
            raise ValueError("clear_page_number_ranges requires at least one range")
        if self.action == "clear_page_number_ranges":
            for page_range in self.ranges:
                if page_range.settings.format != "none":
                    raise ValueError("clear_page_number_ranges ranges must use format none")
        return self