"""
Unit tests for Reciprocal Rank Fusion (RRF) logic.
"""

import pytest

try:
    from apps.retrieval.src.models import ScheduleActivity
    from apps.retrieval.src.rrf_fusion import reciprocal_rank_fusion
except ImportError:
    from src.models import ScheduleActivity
    from src.rrf_fusion import reciprocal_rank_fusion


def test_reciprocal_rank_fusion_combination():
    act1 = ScheduleActivity(id="act_1", activity_id="ACT-1", name="Activity One")
    act2 = ScheduleActivity(id="act_2", activity_id="ACT-2", name="Activity Two")
    act3 = ScheduleActivity(id="act_3", activity_id="ACT-3", name="Activity Three")

    # BM25 ranks: act1 (rank 1), act2 (rank 2)
    bm25_results = [
        (act1, 5.2, 1),
        (act2, 3.1, 2),
    ]

    # Vector ranks: act2 (rank 1), act3 (rank 2)
    vector_results = [
        (act2, 0.85, 1),
        (act3, 0.72, 2),
    ]

    # Compute RRF with k=60
    candidates = reciprocal_rank_fusion(bm25_results, vector_results, k=60, top_k=3)

    assert len(candidates) == 3

    # Expected RRF calculation:
    # act2: 1/(60+2) + 1/(60+1) = 1/62 + 1/61 = 0.016129 + 0.016393 = 0.032522 (Highest)
    # act1: 1/(60+1) + 0        = 1/61 = 0.016393
    # act3: 0        + 1/(60+2) = 1/62 = 0.016129

    top_candidate = candidates[0]
    assert top_candidate.activity_id == "act_2"
    assert top_candidate.rank == 1
    assert pytest.approx(top_candidate.rrf_score, abs=1e-5) == (1 / 61 + 1 / 62)
    assert top_candidate.bm25_score == 3.1
    assert top_candidate.vector_score == 0.85

    assert candidates[1].activity_id == "act_1"
    assert candidates[1].rank == 2

    assert candidates[2].activity_id == "act_3"
    assert candidates[2].rank == 3
