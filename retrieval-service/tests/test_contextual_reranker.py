import pytest

try:
    from apps.retrieval.src.models import (
        ScheduleActivity,
        FieldEvidence,
        CandidateMatch,
        EvidenceContext,
    )
    from apps.retrieval.src.contextual_reranker import ContextualReranker, DEFAULT_FEATURE_WEIGHTS
except ImportError:
    from src.models import (
        ScheduleActivity,
        FieldEvidence,
        CandidateMatch,
        EvidenceContext,
    )
    from src.contextual_reranker import ContextualReranker, DEFAULT_FEATURE_WEIGHTS




@pytest.fixture
def reranker():
    return ContextualReranker()


@pytest.fixture
def sample_activities():
    act1 = ScheduleActivity(
        id="act_001",
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
    )
    act2 = ScheduleActivity(
        id="act_002",
        activity_id="ACT-302",
        name="Substation Wall Electrical Conduit Installation",
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
    )
    return {act1.id: act1, act2.id: act2}


def test_extract_context_from_evidence(reranker):
    evidence = FieldEvidence(
        id="ev_test",
        raw_text="completed concreting work for pier P2 today in North Wing zone",
        extracted_date="2026-09-03",
    )
    context = reranker.extract_context_from_evidence(evidence)

    assert context.discipline == "Civil"
    assert context.activity_type == "Concreting"
    assert "P2" in context.identifiers or "NORTH WING" in context.identifiers or "PIER P2" in context.identifiers or "ZONE NORTH WING" in context.identifiers
    assert context.extracted_date == "2026-09-03"


def test_score_discipline(reranker, sample_activities):
    act_civil = sample_activities["act_001"]
    
    context_matching = EvidenceContext(discipline="Civil")
    assert reranker.score_discipline(context_matching, act_civil) == 1.0

    context_mismatch = EvidenceContext(discipline="Electrical")
    assert reranker.score_discipline(context_mismatch, act_civil) == 0.0


def test_score_location(reranker, sample_activities):
    act_north = sample_activities["act_001"]

    context_exact = EvidenceContext(location="North Wing")
    assert reranker.score_location(context_exact, act_north) == 1.0

    context_partial = EvidenceContext(location="Pier P2")
    assert reranker.score_location(context_partial, act_north) >= 0.8


def test_score_wbs(reranker, sample_activities):
    act = sample_activities["act_001"]  # wbs_path: 1.1.3

    context_exact = EvidenceContext(wbs_path="1.1.3")
    assert reranker.score_wbs(context_exact, act) == 1.0

    context_prefix = EvidenceContext(wbs_path="1.1.2")
    assert 0.5 <= reranker.score_wbs(context_prefix, act) < 1.0


def test_score_identifiers(reranker, sample_activities):
    act = sample_activities["act_001"]  # activity_id: ACT-103

    context = EvidenceContext(identifiers=["ACT-103"])
    assert reranker.score_identifiers(context, act) >= 0.8


def test_score_temporal(reranker, sample_activities):
    act = sample_activities["act_001"]  # 2026-09-02 to 2026-09-04

    context_in_window = EvidenceContext(extracted_date="2026-09-03")
    assert reranker.score_temporal(context_in_window, act) == 1.0

    context_out_window = EvidenceContext(extracted_date="2026-09-25")
    assert reranker.score_temporal(context_out_window, act) < 0.5


def test_rerank_candidates_flow(reranker, sample_activities):
    evidence = FieldEvidence(
        id="ev_001",
        raw_text="completed concreting work for pier P2 today",
        extracted_date="2026-09-03",
    )

    candidates = [
        CandidateMatch(
            activity_id="act_002",
            activity_name="Substation Wall Electrical Conduit Installation",
            activity_code="ACT-302",
            bm25_score=10.0,
            vector_score=0.85,
            rrf_score=0.032,
            rank=1,
            bm25_rank=1,
            vector_rank=1,
        ),
        CandidateMatch(
            activity_id="act_001",
            activity_name="Foundation Pier P2 Concreting and Pouring",
            activity_code="ACT-103",
            bm25_score=9.5,
            vector_score=0.80,
            rrf_score=0.031,
            rank=2,
            bm25_rank=2,
            vector_rank=2,
        ),
    ]

    rerank_res = reranker.rerank_candidates(
        candidate_matches=candidates,
        activities_map=sample_activities,
        evidence=evidence,
        top_k=2,
    )

    assert len(rerank_res.matches) == 2
    # act_001 should move to Rank 1 because of strong contextual matches (Concreting, Pier P2, Date)
    assert rerank_res.matches[0].activity_id == "ACT-103"
    assert rerank_res.matches[0].final_rank == 1
    assert rerank_res.matches[0].confidence_score > 0.5
    assert len(rerank_res.matches[0].matching_reasons) > 0


def test_score_dependencies(reranker):
    pred_act = ScheduleActivity(id="P1", activity_id="ACT-001", name="Excavation", status="COMPLETED")
    succ_act = ScheduleActivity(
        id="P2",
        activity_id="ACT-002",
        name="Pier Concreting",
        predecessors=["ACT-001"],
        status="NOT_STARTED",
    )
    act_map = {"P1": pred_act, "P2": succ_act}

    # When predecessors are completed -> high score
    context = EvidenceContext()
    score_completed = reranker.score_dependencies(context, succ_act, act_map, "starting pier concreting")
    assert score_completed == 1.0

    # When text explicitly mentions predecessor completion -> high score
    score_text = reranker.score_dependencies(context, succ_act, {}, "completed ACT-001 excavation, now starting concreting")
    assert score_text >= 0.85

    # When predecessors are not started -> lower score
    pred_act.status = "NOT_STARTED"
    score_unstarted = reranker.score_dependencies(context, succ_act, act_map, "pier concreting work")
    assert score_unstarted <= 0.35


def test_extract_context_wbs_regex(reranker):
    evidence = FieldEvidence(
        id="ev_wbs",
        raw_text="rebar fixing as per WBS 1.2.3 in North Wing",
    )
    context = reranker.extract_context_from_evidence(evidence)
    assert context.wbs_path == "1.2.3"


def test_check_entity_conflict(reranker):
    act_span2 = ScheduleActivity(id="act_s2", activity_id="ACT-002", name="Erection of Span 2 girder")
    act_span1 = ScheduleActivity(id="act_s1", activity_id="ACT-001", name="Erection of Span 1 girder")

    # Conflict: Evidence has Span 1, activity has Span 2 (Pattern A in EV, Pattern B in ACT)
    ctx1 = EvidenceContext(location="Span 1")
    has_conflict, reason = reranker.check_entity_conflict(ctx1, "inspecting span 1", act_span2)
    assert has_conflict is True
    assert "Conflict" in reason
    assert "SPAN 1" in reason and "SPAN 2" in reason

    # Conflict: Evidence has Span 2, activity has Span 1 (Pattern B in EV, Pattern A in ACT)
    ctx2 = EvidenceContext(location="Span 2")
    has_conflict, reason = reranker.check_entity_conflict(ctx2, "work on span 2", act_span1)
    assert has_conflict is True
    assert "Conflict" in reason
    assert "SPAN 2" in reason and "SPAN 1" in reason

    # Dual reference in evidence: evidence mentions both Span 1 and Span 2 -> NO conflict
    ctx_dual = EvidenceContext()
    has_conflict, reason = reranker.check_entity_conflict(ctx_dual, "spanning between span 1 and span 2", act_span1)
    assert has_conflict is False
    assert reason is None

    # No conflict: matching or unrelated entities
    has_conflict, reason = reranker.check_entity_conflict(ctx1, "span 1 concreting", act_span1)
    assert has_conflict is False
    assert reason is None

