"""
End-to-end integration tests for HybridRetrievalService.
"""

import pytest

try:
    from apps.retrieval.src.retrieval_service import HybridRetrievalService
    from apps.retrieval.src.sample_data import SAMPLE_SCHEDULE_ACTIVITIES, SAMPLE_FIELD_EVIDENCE
except ImportError:
    from src.retrieval_service import HybridRetrievalService
    from src.sample_data import SAMPLE_SCHEDULE_ACTIVITIES, SAMPLE_FIELD_EVIDENCE


@pytest.fixture(scope="module")
def indexed_service():
    service = HybridRetrievalService()
    service.index_activities(SAMPLE_SCHEDULE_ACTIVITIES)
    return service


def test_hybrid_retrieval_concreting_query(indexed_service):
    # Query: "completed concreting work for pier P2 today"
    evidence = SAMPLE_FIELD_EVIDENCE[0]
    result = indexed_service.retrieve_for_evidence(evidence, top_k=3)

    assert result.evidence_id == "ev_001"
    assert len(result.matches) == 3

    top_match = result.matches[0]
    # Should match ACT-103 "Foundation Pier P2 Concreting and Pouring"
    assert top_match.activity_code == "ACT-103"
    assert top_match.rank == 1
    assert top_match.bm25_score > 0
    assert top_match.vector_score > 0
    assert top_match.rrf_score > 0


def test_hybrid_retrieval_drainage_query(indexed_service):
    # Query: "excavation work ongoing for L1 stormwater drain north perimeter section"
    evidence = SAMPLE_FIELD_EVIDENCE[1]
    result = indexed_service.retrieve_for_evidence(evidence, top_k=3)

    top_match = result.matches[0]
    # Should match ACT-301 "Stormwater Drainage Pipe Installation L1 North Section"
    assert top_match.activity_code in ["ACT-301", "ACT-101"]
    assert top_match.rank == 1


def test_hybrid_retrieval_result_serialization(indexed_service):
    evidence = SAMPLE_FIELD_EVIDENCE[2]
    result = indexed_service.retrieve_for_evidence(evidence, top_k=2)

    res_dict = result.to_dict()
    assert res_dict["evidence_id"] == "ev_003"
    assert "matches" in res_dict
    assert len(res_dict["matches"]) == 2

    match = res_dict["matches"][0]
    assert "activity_id" in match
    assert "activity_name" in match
    assert "activity_code" in match
    assert "bm25_score" in match
    assert "vector_score" in match
    assert "rrf_score" in match
    assert "rank" in match
