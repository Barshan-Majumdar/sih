"""Unit tests for extraction schemas and prompt construction."""

import pytest
from pydantic import ValidationError

try:
    from apps.retrieval.src.extraction.schemas import (
        ExtractedObservationItem,
        ExtractRequest,
    )
    from apps.retrieval.src.extraction.prompt import build_extraction_prompt
except ImportError:
    from src.extraction.schemas import ExtractedObservationItem, ExtractRequest
    from src.extraction.prompt import build_extraction_prompt


def test_item_accepts_all_prd_event_types():
    for event_type in ["STARTED", "COMPLETED", "PAUSED", "REWORK", "PROGRESS"]:
        item = ExtractedObservationItem(
            raw_text="Excavation completed at Pier 1",
            event_type=event_type,
            extracted_date="2026-09-07",
        )
        assert item.event_type == event_type


def test_item_rejects_unknown_event_type():
    with pytest.raises(ValidationError):
        ExtractedObservationItem(
            raw_text="something",
            event_type="EXPLODED",
            extracted_date="2026-09-07",
        )


def test_item_rejects_out_of_range_progress():
    with pytest.raises(ValidationError):
        ExtractedObservationItem(
            raw_text="x",
            event_type="PROGRESS",
            extracted_date="2026-09-07",
            progress_percent=140.0,
        )


def test_item_progress_percent_defaults_to_none():
    item = ExtractedObservationItem(
        raw_text="x", event_type="PAUSED", extracted_date="2026-09-07"
    )
    assert item.progress_percent is None
    assert item.source_snippet is None


def test_request_rejects_empty_payload():
    with pytest.raises(ValidationError):
        ExtractRequest()


def test_request_accepts_text_only():
    req = ExtractRequest(report_text="Poured 45 cubic metres at Pier 2")
    assert req.document_base64 is None


def test_request_requires_mime_type_with_document():
    with pytest.raises(ValidationError):
        ExtractRequest(document_base64="aGVsbG8=")


def test_prompt_lists_every_event_type_and_the_report_date():
    prompt = build_extraction_prompt("Excavation done at Pier 1", "2026-09-07")
    for event_type in ["STARTED", "COMPLETED", "PAUSED", "REWORK", "PROGRESS"]:
        assert event_type in prompt
    assert "2026-09-07" in prompt
    assert "Excavation done at Pier 1" in prompt


def test_prompt_handles_document_only_extraction():
    prompt = build_extraction_prompt(None, "2026-09-07")
    assert "2026-09-07" in prompt
    assert "attached document" in prompt.lower()
