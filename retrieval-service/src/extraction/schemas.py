"""Pydantic contracts for the LLM extraction engine."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

EventType = Literal["STARTED", "COMPLETED", "PAUSED", "REWORK", "PROGRESS"]

EVENT_TYPES: List[str] = ["STARTED", "COMPLETED", "PAUSED", "REWORK", "PROGRESS"]


class ExtractedObservationItem(BaseModel):
    """One atomic activity-level event. A single report yields many of these."""

    raw_text: str = Field(min_length=1)
    event_type: EventType
    extracted_date: str
    progress_percent: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    source_snippet: Optional[str] = None


class ExtractRequest(BaseModel):
    report_text: Optional[str] = None
    document_base64: Optional[str] = None
    document_mime_type: Optional[str] = None
    report_date: Optional[str] = None

    @model_validator(mode="after")
    def require_some_input(self) -> "ExtractRequest":
        if not self.report_text and not self.document_base64:
            raise ValueError("Provide report_text, document_base64, or both.")
        if self.document_base64 and not self.document_mime_type:
            raise ValueError("document_mime_type is required when document_base64 is set.")
        return self


class ExtractResponse(BaseModel):
    items: List[ExtractedObservationItem]
    model: str
    elapsed_ms: float
    discarded: int = 0
