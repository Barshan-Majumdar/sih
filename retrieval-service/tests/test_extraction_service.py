"""Extraction service tests. No network calls - the client is faked."""

import pytest

try:
    from apps.retrieval.src.extraction.schemas import ExtractRequest
    from apps.retrieval.src.extraction.service import ExtractionService
except ImportError:
    from src.extraction.schemas import ExtractRequest
    from src.extraction.service import ExtractionService


class FakeClient:
    model_name = "fake-model"

    def __init__(self, payload):
        self.payload = payload
        self.last_prompt = None
        self.last_document = None

    def generate(self, prompt, document_base64=None, document_mime_type=None):
        self.last_prompt = prompt
        self.last_document = document_base64
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload


DPR = (
    "Shift Report 07-Sep: Excavation completed at Pier 1 (100%). "
    "Poured 45m3 concrete at Pier 2 (approx 65%). "
    "Work paused on Span 1 girder erection due to high wind."
)


def three_item_payload():
    return [
        {
            "raw_text": "Excavation completed at Pier 1",
            "event_type": "COMPLETED",
            "extracted_date": "2026-09-07",
            "progress_percent": 100,
            "source_snippet": "Excavation completed at Pier 1 (100%)",
        },
        {
            "raw_text": "Poured 45 cubic metres of concrete at Pier 2",
            "event_type": "PROGRESS",
            "extracted_date": "2026-09-07",
            "progress_percent": 65,
            "source_snippet": "Poured 45m3 concrete at Pier 2 (approx 65%)",
        },
        {
            "raw_text": "Span 1 girder erection paused due to high wind",
            "event_type": "PAUSED",
            "extracted_date": "2026-09-07",
            "progress_percent": None,
            "source_snippet": "Work paused on Span 1 girder erection due to high wind",
        },
    ]


def test_splits_one_report_into_three_observations():
    service = ExtractionService(client=FakeClient(three_item_payload()))
    res = service.extract(ExtractRequest(report_text=DPR, report_date="2026-09-07"))

    assert len(res.items) == 3
    assert [i.event_type for i in res.items] == ["COMPLETED", "PROGRESS", "PAUSED"]
    assert res.items[0].progress_percent == 100
    assert res.items[2].progress_percent is None
    assert res.model == "fake-model"
    assert res.elapsed_ms >= 0


def test_report_text_reaches_the_prompt():
    client = FakeClient(three_item_payload())
    ExtractionService(client=client).extract(
        ExtractRequest(report_text=DPR, report_date="2026-09-07")
    )
    assert DPR in client.last_prompt


def test_document_is_forwarded_to_the_client():
    client = FakeClient([])
    ExtractionService(client=client).extract(
        ExtractRequest(
            document_base64="aGVsbG8=",
            document_mime_type="application/pdf",
            report_date="2026-09-07",
        )
    )
    assert client.last_document == "aGVsbG8="


def test_malformed_items_are_skipped_not_fatal():
    payload = three_item_payload() + [{"raw_text": "", "event_type": "NOPE"}]
    service = ExtractionService(client=FakeClient(payload))
    res = service.extract(ExtractRequest(report_text=DPR, report_date="2026-09-07"))
    assert len(res.items) == 3
    assert res.discarded == 1


def test_missing_date_falls_back_to_report_date():
    payload = [{"raw_text": "Excavation done", "event_type": "COMPLETED"}]
    service = ExtractionService(client=FakeClient(payload))
    res = service.extract(ExtractRequest(report_text=DPR, report_date="2026-09-07"))
    assert res.items[0].extracted_date == "2026-09-07"


def test_out_of_range_progress_is_clamped():
    payload = [
        {
            "raw_text": "Excavation done",
            "event_type": "COMPLETED",
            "extracted_date": "2026-09-07",
            "progress_percent": 140,
        }
    ]
    service = ExtractionService(client=FakeClient(payload))
    res = service.extract(ExtractRequest(report_text=DPR, report_date="2026-09-07"))
    assert res.items[0].progress_percent == 100


def test_client_failure_raises_runtime_error():
    service = ExtractionService(client=FakeClient(RuntimeError("quota exceeded")))
    with pytest.raises(RuntimeError):
        service.extract(ExtractRequest(report_text=DPR, report_date="2026-09-07"))


def test_empty_result_is_valid():
    service = ExtractionService(client=FakeClient([]))
    res = service.extract(ExtractRequest(report_text="Good morning team.", report_date="2026-09-07"))
    assert res.items == []
    assert res.discarded == 0
