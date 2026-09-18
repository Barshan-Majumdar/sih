"""
BM25 Keyword-based Retrieval Module using rank-bm25.
"""

import re
from typing import List, Tuple, Optional
from rank_bm25 import BM25Okapi
from .models import ScheduleActivity


def tokenize_text(text: str) -> List[str]:
    """
    Simple, effective tokenization for construction domain text:
    lowercasing and splitting into alphanumeric tokens.
    """
    clean_text = text.lower()
    tokens = re.findall(r"\b\w+\b", clean_text)
    return tokens


class BM25Retriever:
    """
    Keyword-based BM25 retriever for schedule activities.
    """

    def __init__(self):
        self.activities: List[ScheduleActivity] = []
        self.corpus_tokens: List[List[str]] = []
        self.bm25_index: Optional[BM25Okapi] = None

    def fit(self, activities: List[ScheduleActivity]) -> None:
        """
        Index schedule activities for BM25 search.
        """
        self.activities = list(activities)
        self.corpus_tokens = [tokenize_text(act.to_search_text()) for act in self.activities]
        if self.corpus_tokens:
            self.bm25_index = BM25Okapi(self.corpus_tokens)
        else:
            self.bm25_index = None

    def search(self, query: str, top_k: int = 10) -> List[Tuple[ScheduleActivity, float, int]]:
        """
        Perform BM25 search for a given query string.
        
        Returns:
            List of tuples: (ScheduleActivity, bm25_score, rank_1_indexed)
        """
        if not self.bm25_index or not self.activities:
            return []

        query_tokens = tokenize_text(query)
        if not query_tokens:
            return []

        scores = self.bm25_index.get_scores(query_tokens)
        
        # Sort indices by score descending
        ranked_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        
        results: List[Tuple[ScheduleActivity, float, int]] = []
        top_indices = ranked_indices[:top_k]
        
        for rank_idx, idx in enumerate(top_indices, start=1):
            results.append((self.activities[idx], float(scores[idx]), rank_idx))
            
        return results
