"""
Unit tests for VectorRetriever module.
"""

import pytest

try:
    from apps.retrieval.src.models import ScheduleActivity
    from apps.retrieval.src.vector_retriever import VectorRetriever
except ImportError:
    from src.models import ScheduleActivity
    from src.vector_retriever import VectorRetriever


def test_vector_retriever_semantic_match():
    activities = [
        ScheduleActivity(id="1", activity_id="ACT-101", name="Foundation Pier P1 Excavation and Digging"),
        ScheduleActivity(id="2", activity_id="ACT-102", name="Foundation Pier P2 Concreting and Pouring"),
        ScheduleActivity(id="3", activity_id="ACT-103", name="Electrical Wire & Conduit Fitting in Substation"),
    ]

    retriever = VectorRetriever(model_name="all-MiniLM-L6-v2")
    retriever.fit(activities)

    # Search with messy semantic query (synonyms/paraphrasing)
    results = retriever.search("pouring cement for pier 2 foundation", top_k=2)

    assert len(results) == 2
    top_activity, sim_score, rank = results[0]
    assert top_activity.id == "2"
    assert sim_score > 0.3  # Cosine similarity threshold
    assert rank == 1


def test_vector_retriever_empty_activities():
    retriever = VectorRetriever(model_name="all-MiniLM-L6-v2")
    retriever.fit([])

    results = retriever.search("test query", top_k=5)
    assert results == []
