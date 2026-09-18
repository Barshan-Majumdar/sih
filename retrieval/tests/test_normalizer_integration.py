"""
Integration tests for Terminology Normalization in Hybrid Candidate Retrieval pipeline.
"""

import pytest

try:
    from apps.retrieval.src import (
        HybridRetrievalService,
        ScheduleActivity,
        FieldEvidence,
        TerminologyNormalizer,
    )
except ImportError:
    from src import (
        HybridRetrievalService,
        ScheduleActivity,
        FieldEvidence,
        TerminologyNormalizer,
    )


@pytest.fixture
def retrieval_service():
    service = HybridRetrievalService(use_normalization=True)
    activities = [
        ScheduleActivity(
            id="act_001",
            activity_id="ACT-102",
            name="Deep Foundation Pit Excavation - Pier P1 and P2",
            level=2,
            metadata={"discipline": "Civil", "activity_type": "Excavation"},
        ),
        ScheduleActivity(
            id="act_002",
            activity_id="ACT-202",
            name="Foundation Pier P1 Rebar Cage Assembly and Placement",
            level=3,
            metadata={"discipline": "Civil", "activity_type": "Rebar & Formwork"},
        ),
        ScheduleActivity(
            id="act_003",
            activity_id="ACT-301",
            name="Prestressed Concrete Girder Erection - Span 1",
            level=2,
            metadata={"discipline": "Structural", "activity_type": "Structural Erection"},
        ),
    ]
    service.index_activities(activities)
    return service


def test_retrieval_with_shorthand_jargon(retrieval_service):
    # Query contains shorthand 'excav' and 'PSC'
    evidence = FieldEvidence(
        id="ev_jargon_01",
        raw_text="excav work ongoing for deep foundation pit",
    )

    res = retrieval_service.retrieve_for_evidence(evidence, top_k=2)

    assert len(res.matches) > 0
    top_match = res.matches[0]
    assert top_match.activity_code == "ACT-102" or top_match.activity_id == "act_001"
    assert evidence.raw_text == "excav work ongoing for deep foundation pit"
    assert evidence.normalized_text is not None
    assert "excavation" in evidence.normalized_text.lower()


def test_retrieval_with_psc_jargon(retrieval_service):
    evidence = FieldEvidence(
        id="ev_jargon_02",
        raw_text="PSC girder launched over span 1",
    )

    res = retrieval_service.retrieve_for_evidence(evidence, top_k=2)

    assert len(res.matches) > 0
    assert res.matches[0].activity_code == "ACT-301" or res.matches[0].activity_id == "act_003"
    assert "prestressed concrete" in evidence.normalized_text.lower()

