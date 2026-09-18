"""
Hybrid Candidate Retrieval Service orchestrating BM25, FAISS Vector Search, RRF Fusion, and Contextual Reranking.
"""

from typing import List, Optional, Dict
from .models import (
    ScheduleActivity,
    FieldEvidence,
    CandidateMatch,
    HybridRetrievalResult,
    EvidenceContext,
    RerankResult,
)
from .bm25_retriever import BM25Retriever
from .vector_retriever import VectorRetriever
from .rrf_fusion import reciprocal_rank_fusion
from .contextual_reranker import ContextualReranker
from .terminology_normalizer import TerminologyNormalizer


class HybridRetrievalService:
    """
    Modular service that indexes schedule activities and retrieves top matching candidate
    activities for field evidence inputs using a hybrid search strategy (BM25 + FAISS Vector + RRF),
    pre-processed by a Terminology Normalization layer, and optionally re-ranked using
    Stage 2 Contextual Matching.
    """

    def __init__(
        self,
        embedding_model_name: str = "all-MiniLM-L6-v2",
        normalizer: Optional[TerminologyNormalizer] = None,
        use_normalization: bool = True,
    ):
        self.bm25_retriever = BM25Retriever()
        self.vector_retriever = VectorRetriever(model_name=embedding_model_name)
        self.normalizer = normalizer or TerminologyNormalizer()
        self.reranker = ContextualReranker(normalizer=self.normalizer)
        self.use_normalization = use_normalization
        self.activities: List[ScheduleActivity] = []
        self.activities_map: Dict[str, ScheduleActivity] = {}

    def index_activities(self, activities: List[ScheduleActivity]) -> None:
        """
        Index schedule activities in both BM25 and Vector retrievers, and build activity lookup map.
        """
        self.activities = list(activities)
        self.activities_map = {act.id: act for act in self.activities}
        self.bm25_retriever.fit(self.activities)
        self.vector_retriever.fit(self.activities)

    def retrieve_candidates(
        self,
        query: str,
        evidence_id: str = "EV-001",
        top_k: int = 5,
        candidate_depth: int = 20,
        rrf_k: int = 60,
        normalized_query: Optional[str] = None,
    ) -> HybridRetrievalResult:
        """
        Retrieve top matching schedule activities for a field evidence query.

        Args:
            query: Unstructured / messy field evidence text string.
            evidence_id: Optional identifier for the input evidence.
            top_k: Number of final top candidate matches to return.
            candidate_depth: Depth of initial candidates to pull from BM25 and Vector retrievers.
            rrf_k: Reciprocal Rank Fusion smoothing parameter.
            normalized_query: Optional pre-normalized search query.

        Returns:
            HybridRetrievalResult containing ranked CandidateMatch list.
        """
        if not query or not query.strip():
            return HybridRetrievalResult(evidence_id=evidence_id, raw_text=query, matches=[])

        # Apply Terminology Normalization for search query if enabled
        if normalized_query:
            search_text = normalized_query
        elif self.use_normalization and self.normalizer:
            search_text = self.normalizer.normalize_text(query, append_original=True)
        else:
            search_text = query

        # 1. BM25 Keyword Search
        bm25_results = self.bm25_retriever.search(search_text, top_k=candidate_depth)

        # 2. FAISS Vector Search
        vector_results = self.vector_retriever.search(search_text, top_k=candidate_depth)

        # 3. Reciprocal Rank Fusion (RRF)
        matches = reciprocal_rank_fusion(
            bm25_results=bm25_results,
            vector_results=vector_results,
            k=rrf_k,
            top_k=top_k,
        )

        return HybridRetrievalResult(
            evidence_id=evidence_id,
            raw_text=query,
            matches=matches,
        )

    def retrieve_for_evidence(
        self,
        evidence: FieldEvidence,
        top_k: int = 5,
        candidate_depth: int = 20,
        rrf_k: int = 60,
    ) -> HybridRetrievalResult:
        """
        Convenience method to retrieve candidates given a FieldEvidence object.
        """
        search_text = evidence.normalized_text
        if not search_text and self.use_normalization and self.normalizer:
            search_text = self.normalizer.normalize_text(evidence.raw_text, append_original=True)
            evidence.normalized_text = search_text

        return self.retrieve_candidates(
            query=evidence.raw_text,
            evidence_id=evidence.id,
            top_k=top_k,
            candidate_depth=candidate_depth,
            rrf_k=rrf_k,
            normalized_query=search_text,
        )

    def retrieve_and_rerank(
        self,
        evidence: FieldEvidence,
        explicit_context: Optional[EvidenceContext] = None,
        top_k: int = 5,
        candidate_depth: int = 20,
        rrf_k: int = 60,
    ) -> RerankResult:
        """
        Executes Stage 1 Hybrid Retrieval (BM25 + FAISS + RRF) with Terminology Normalization,
        then applies Stage 2 Contextual Matching & Reranking to return top_k reranked matches.
        """
        # 1. Stage 1 Retrieval
        stage1_result = self.retrieve_for_evidence(
            evidence,
            top_k=candidate_depth,
            candidate_depth=candidate_depth,
            rrf_k=rrf_k,
        )

        # 2. Stage 2 Contextual Reranking
        return self.reranker.rerank_candidates(
            candidate_matches=stage1_result.matches,
            activities_map=self.activities_map,
            evidence=evidence,
            explicit_context=explicit_context,
            top_k=top_k,
        )


