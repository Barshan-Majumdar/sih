"""
Unit tests for BM25Retriever module.
"""

import pytest

try:
    from apps.retrieval.src.models import ScheduleActivity
    from apps.retrieval.src.bm25_retriever import BM25Retriever, tokenize_text
except ImportError:
    from src.models import ScheduleActivity
    from src.bm25_retriever import BM25Retriever, tokenize_text


def test_tokenize_text():
    text = "Pier P2 Concreting & Pouring work, 100%!"
    tokens = tokenize_text(text)
    assert "pier" in tokens
    assert "p2" in tokens
    assert "concreting" in tokens
    assert "100" in tokens


def test_bm25_retriever_search():
    activities = [
        ScheduleActivity(id="1", activity_id="ACT-101", name="Foundation Pier P1 Excavation"),
        ScheduleActivity(id="2", activity_id="ACT-102", name="Foundation Pier P2 Concreting"),
        ScheduleActivity(id="3", activity_id="ACT-103", name="Superstructure Deck Slab Concrete"),
    ]

    retriever = BM25Retriever()
    retriever.fit(activities)

    # Search for Pier P2 concreting keyword match
    results = retriever.search("pier P2 concreting", top_k=2)

    assert len(results) == 2
    top_activity, score, rank = results[0]
    assert top_activity.id == "2"
    assert score > 0.0
    assert rank == 1


def test_bm25_retriever_empty_query():
    activities = [ScheduleActivity(id="1", activity_id="ACT-1", name="Test Activity")]
    retriever = BM25Retriever()
    retriever.fit(activities)

    results = retriever.search("", top_k=5)
    assert results == []
