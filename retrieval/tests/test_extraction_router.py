"""HTTP-level tests for the extraction router with an injected fake service."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

try:
    from apps.retrieval.src.extraction.router import build_extraction_router
    from apps.retrieval.src.extraction.service import ExtractionService
except ImportError:
    from src.extraction.router import build_extraction_router
    from src.extraction.service import ExtractionService


class FakeClient:
    model_name = "fake-model"

    def __init__(self, payload):
        self.payload = payload

    def generate(self, prompt, document_base64=None, document_mime_type=None):
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload


def make_client(payload):
    app = FastAPI()
    app.include_router(
        build_extraction_router(lambda: ExtractionService(client=FakeClient(payload)))
    )
    return TestClient(app)


PAYLOAD = [
    {
        "raw_text": "Excavation completed at Pier 1",
        "event_type": "COMPLETED",
        "extracted_date": "2026-09-07",
        "progress_percent": 100,
        "source_snippet": "Excavation completed at Pier 1 (100%)",
    },
    {
        "raw_text": "Span 1 girder erection paused due to high wind",
        "event_type": "PAUSED",
        "extracted_date": "2026-09-07",
        "progress_percent": None,
        "source_snippet": "Work paused on Span 1 girder erection",
    },
]


def test_analyze_returns_multiple_items():
    res = make_client(PAYLOAD).post(
        "/api/extraction/analyze",
        json={"report_text": "Excavation completed at Pier 1. Work paused on Span 1.",
              "report_date": "2026-09-07"},
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 2
    assert body["items"][0]["event_type"] == "COMPLETED"
    assert body["model"] == "fake-model"
    assert "elapsed_ms" in body


def test_analyze_rejects_empty_payload():
    res = make_client(PAYLOAD).post("/api/extraction/analyze", json={})
    assert res.status_code == 422


def test_analyze_rejects_document_without_mime_type():
    res = make_client(PAYLOAD).post(
        "/api/extraction/analyze", json={"document_base64": "aGVsbG8="}
    )
    assert res.status_code == 422


def test_client_failure_returns_502():
    res = make_client(RuntimeError("quota exceeded")).post(
        "/api/extraction/analyze",
        json={"report_text": "anything", "report_date": "2026-09-07"},
    )
    assert res.status_code == 502
    assert "quota exceeded" in res.json()["detail"]


def test_health_reports_unconfigured_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    app = FastAPI()

    def failing_factory():
        raise RuntimeError("GEMINI_API_KEY is not set.")

    app.include_router(build_extraction_router(failing_factory))
    res = TestClient(app).get("/api/extraction/health")

    assert res.status_code == 200
    assert res.json()["status"] == "unconfigured"
