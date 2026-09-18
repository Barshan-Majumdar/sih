import pytest

try:
    from apps.retrieval.src import (
        HybridRetrievalService,
        ScheduleActivity,
        FieldEvidence,
        EvidenceContext,
    )
except ImportError:
    from src import (
        HybridRetrievalService,
        ScheduleActivity,
        FieldEvidence,
        EvidenceContext,
    )




@pytest.fixture
def retrieval_service():
    service = HybridRetrievalService()
    activities = [
        ScheduleActivity(
            id="act_001",
            activity_id="ACT-101",
            name="Site Excavation and Earthwork for Foundation Pier P1 & P2",
            level=2,
            metadata={
                "zone": "North Wing",
                "discipline": "Civil",
                "asset": "Pier P1",
                "wbs_path": "1.1.1",
                "activity_type": "Excavation",
                "planned_start_date": "2026-08-15",
                "planned_end_date": "2026-08-30",
            },
        ),
        ScheduleActivity(
            id="act_002",
            activity_id="ACT-102",
            name="Foundation Pier P1 Rebar Cage Assembly and Placement",
            level=3,
            metadata={
                "zone": "North Wing",
                "discipline": "Civil",
                "asset": "Pier P1",
                "wbs_path": "1.1.2",
                "activity_type": "Rebar & Formwork",
                "planned_start_date": "2026-09-01",
                "planned_end_date": "2026-09-05",
            },
        ),
        ScheduleActivity(
            id="act_003",
            activity_id="ACT-103",
            name="Foundation Pier P2 Concreting and Pouring",
            level=3,
            metadata={
                "zone": "North Wing",
                "discipline": "Civil",
                "asset": "Pier P2",
                "wbs_path": "1.1.3",
                "activity_type": "Concreting",
                "planned_start_date": "2026-09-02",
                "planned_end_date": "2026-09-04",
            },
        ),
        ScheduleActivity(
            id="act_004",
            activity_id="ACT-302",
            name="Substation Wall Electrical Conduit Installation & Cable Trenching",
            level=2,
            metadata={
                "zone": "Utilities",
                "discipline": "Electrical",
                "asset": "Substation",
                "wbs_path": "1.3.2",
                "activity_type": "Electrical Installation",
                "planned_start_date": "2026-09-02",
                "planned_end_date": "2026-09-08",
            },
        ),
    ]
    service.index_activities(activities)
    return service


def test_retrieve_and_rerank_end_to_end(retrieval_service):
    evidence = FieldEvidence(
        id="ev_001",
        raw_text="completed concreting work for pier P2 today around 4pm with 35m3 slump concrete",
        extracted_date="2026-09-03",
        event_type="COMPLETED",
    )

    rerank_result = retrieval_service.retrieve_and_rerank(evidence, top_k=3)

    assert rerank_result.evidence_id == "ev_001"
    assert len(rerank_result.matches) > 0

    top_match = rerank_result.matches[0]
    # ACT-103 should be the #1 top match
    assert top_match.activity_id == "ACT-103"
    assert top_match.final_rank == 1
    assert top_match.confidence_score > 0.6
    
    # Check score structures
    assert "bm25_score" in top_match.original_retrieval_scores
    assert "vector_score" in top_match.original_retrieval_scores
    assert "rrf_score" in top_match.original_retrieval_scores
    
    assert "discipline" in top_match.contextual_feature_scores
    assert "location" in top_match.contextual_feature_scores
    assert "temporal" in top_match.contextual_feature_scores

    assert len(top_match.matching_reasons) > 0


def test_explicit_context_override(retrieval_service):
    evidence = FieldEvidence(
        id="ev_002",
        raw_text="conduit installation work completed",
        extracted_date="2026-09-03",
    )

    explicit_ctx = EvidenceContext(
        discipline="Electrical",
        location="Utilities",
        activity_type="Electrical Installation",
    )

    rerank_result = retrieval_service.retrieve_and_rerank(
        evidence, explicit_context=explicit_ctx, top_k=2
    )

    assert len(rerank_result.matches) > 0
    top_match = rerank_result.matches[0]
    assert top_match.activity_id == "ACT-302"
    assert top_match.contextual_feature_scores["discipline"] == 1.0
    assert top_match.contextual_feature_scores["location"] == 1.0
