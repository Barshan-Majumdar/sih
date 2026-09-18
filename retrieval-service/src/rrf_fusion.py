"""
Reciprocal Rank Fusion (RRF) module to combine BM25 and Vector retrieval results.
"""

from typing import List, Tuple, Dict, Any
from .models import ScheduleActivity, CandidateMatch


def reciprocal_rank_fusion(
    bm25_results: List[Tuple[ScheduleActivity, float, int]],
    vector_results: List[Tuple[ScheduleActivity, float, int]],
    k: int = 60,
    top_k: int = 10,
) -> List[CandidateMatch]:
    """
    Combine BM25 and Vector search results using Reciprocal Rank Fusion (RRF).

    Formula:
        RRF_Score(d) = sum_{m in {BM25, Vector}} 1 / (k + rank_m(d))

    Args:
        bm25_results: List of (ScheduleActivity, bm25_score, bm25_rank)
        vector_results: List of (ScheduleActivity, vector_score, vector_rank)
        k: RRF smoothing constant (default 60)
        top_k: Number of top candidate matches to return

    Returns:
        Sorted list of CandidateMatch objects ranked by rrf_score descending.
    """
    activity_map: Dict[str, ScheduleActivity] = {}
    bm25_scores: Dict[str, float] = {}
    bm25_ranks: Dict[str, int] = {}
    vector_scores: Dict[str, float] = {}
    vector_ranks: Dict[str, int] = {}

    for activity, score, rank in bm25_results:
        act_id = activity.id
        activity_map[act_id] = activity
        bm25_scores[act_id] = score
        bm25_ranks[act_id] = rank

    for activity, score, rank in vector_results:
        act_id = activity.id
        activity_map[act_id] = activity
        vector_scores[act_id] = score
        vector_ranks[act_id] = rank

    # Compute RRF score for every unique candidate
    rrf_scores: Dict[str, float] = {}
    all_act_ids = set(bm25_ranks.keys()) | set(vector_ranks.keys())

    for act_id in all_act_ids:
        rrf = 0.0
        if act_id in bm25_ranks:
            rrf += 1.0 / (k + bm25_ranks[act_id])
        if act_id in vector_ranks:
            rrf += 1.0 / (k + vector_ranks[act_id])
        rrf_scores[act_id] = rrf

    # Sort activity IDs by RRF score descending
    sorted_act_ids = sorted(
        all_act_ids,
        key=lambda act_id: (rrf_scores[act_id], vector_scores.get(act_id, 0.0), bm25_scores.get(act_id, 0.0)),
        reverse=True,
    )

    candidates: List[CandidateMatch] = []
    for rank_idx, act_id in enumerate(sorted_act_ids[:top_k], start=1):
        activity = activity_map[act_id]
        match = CandidateMatch(
            activity_id=activity.id,
            activity_name=activity.name,
            activity_code=activity.activity_id,
            bm25_score=bm25_scores.get(act_id, 0.0),
            vector_score=vector_scores.get(act_id, 0.0),
            rrf_score=rrf_scores[act_id],
            rank=rank_idx,
            bm25_rank=bm25_ranks.get(act_id),
            vector_rank=vector_ranks.get(act_id),
            metadata=activity.metadata,
        )
        candidates.append(match)

    return candidates
