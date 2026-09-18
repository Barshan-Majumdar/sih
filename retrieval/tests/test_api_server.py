"""
Unit & Integration tests for FastAPI REST Server.
"""

import pytest
from fastapi.testclient import TestClient

try:
    from apps.retrieval.src.server import app
except ImportError:
    from src.server import app

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "indexed_activities_count" in data


def test_index_and_match_pipeline():
    index_payload = {
        "activities": [
            {
                "id": "act_001",
                "activity_id": "ACT-102",
                "name": "Foundation Pier P1 Rebar Cage Assembly",
                "level": 3,
                "planned_start_date": "2026-09-01",
                "planned_end_date": "2026-09-05",
                "metadata": {
                    "zone": "North Wing",
                    "discipline": "Civil",
                    "asset": "Pier P1",
                    "activity_type": "Rebar & Formwork",
                },
            },
            {
                "id": "act_002",
                "activity_id": "ACT-103",
                "name": "Foundation Pier P2 Concreting and Pouring",
                "level": 3,
                "planned_start_date": "2026-09-02",
                "planned_end_date": "2026-09-04",
                "metadata": {
                    "zone": "North Wing",
                    "discipline": "Civil",
                    "asset": "Pier P2",
                    "activity_type": "Concreting",
                },
            },
        ]
    }

    index_res = client.post("/api/retrieval/index", json=index_payload)
    assert index_res.status_code == 200
    assert index_res.json()["indexed_count"] == 2

    # 2. Test Normalization Endpoint
    norm_res = client.post(
        "/api/retrieval/normalize",
        json={"text": "rebar cage tying and shuttering for pier 1"},
    )
    assert norm_res.status_code == 200
    assert "reinforcement" in norm_res.json()["normalized_text"].lower()

    # 3. Test Full Pipeline Match Endpoint
    match_payload = {
        "evidence": {
            "id": "ev_test_01",
            "raw_text": "completed concreting work for pier P2 today",
            "extracted_date": "2026-09-03",
        },
        "top_k": 2,
    }

    match_res = client.post("/api/retrieval/match", json=match_payload)
    assert match_res.status_code == 200
    data = match_res.json()

    assert data["evidence_id"] == "ev_test_01"
    assert len(data["matches"]) > 0
    top_match = data["matches"][0]
    assert top_match["activity_id"] == "ACT-103"
    assert top_match["final_rank"] == 1
    assert "confidence_score" in top_match
    assert len(top_match["matching_reasons"]) > 0
