"""
Data models for Hybrid Candidate Retrieval.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional


@dataclass
class ScheduleActivity:
    """
    Represents a schedule activity from WBS/schedule hierarchy with sequencing dependencies.
    """
    id: str
    activity_id: str
    name: str
    level: int = 1
    parent_id: Optional[str] = None
    planned_start_date: Optional[str] = None
    planned_end_date: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    predecessors: List[str] = field(default_factory=list)
    successors: List[str] = field(default_factory=list)
    status: Optional[str] = None

    def to_search_text(self) -> str:
        """
        Generate a rich search document text combining activity code, name, level, and metadata.
        """
        parts = [f"[{self.activity_id}]", self.name]
        if self.metadata and "zone" in self.metadata:
            parts.append(f"Zone: {self.metadata['zone']}")
        if self.metadata and "description" in self.metadata:
            parts.append(str(self.metadata["description"]))
        return " ".join(parts)


@dataclass
class FieldEvidence:
    """
    Represents raw, unstructured field evidence / observations.
    """
    id: str
    raw_text: str
    extracted_date: Optional[str] = None
    event_type: Optional[str] = None
    normalized_text: Optional[str] = None



@dataclass
class CandidateMatch:
    """
    Represents a schedule activity matched against field evidence with scores and rank.
    """
    activity_id: str
    activity_name: str
    activity_code: str
    bm25_score: float
    vector_score: float
    rrf_score: float
    rank: int
    bm25_rank: Optional[int] = None
    vector_rank: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "activity_id": self.activity_id,
            "activity_db_id": self.activity_id,
            "activity_name": self.activity_name,
            "schedule_activity_id": self.activity_id,
            "name": self.activity_name,
            "activity_code": self.activity_code,
            "bm25_score": round(self.bm25_score, 4),
            "vector_score": round(self.vector_score, 4),
            "rrf_score": round(self.rrf_score, 6),
            "rank": self.rank,
            "bm25_rank": self.bm25_rank,
            "vector_rank": self.vector_rank,
            "metadata": self.metadata,
        }


@dataclass
class EvidenceContext:
    """
    Structured context extracted or provided alongside field evidence for contextual matching.
    """
    discipline: Optional[str] = None
    location: Optional[str] = None
    asset: Optional[str] = None
    wbs_path: Optional[str] = None
    activity_type: Optional[str] = None
    identifiers: List[str] = field(default_factory=list)
    extracted_date: Optional[str] = None
    detected_disciplines: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ContextualFeatureScores:
    """
    Individual contextual compatibility component scores (0.0 to 1.0) and aggregate context score.
    """
    discipline_score: float = 0.0
    location_score: float = 0.0
    asset_score: float = 0.0
    wbs_score: float = 0.0
    activity_type_score: float = 0.0
    identifier_score: float = 0.0
    temporal_score: float = 0.0
    dependency_score: float = 0.0
    aggregate_context_score: float = 0.0

    def to_dict(self) -> Dict[str, float]:
        return {
            "discipline": round(self.discipline_score, 4),
            "location": round(self.location_score, 4),
            "asset": round(self.asset_score, 4),
            "wbs": round(self.wbs_score, 4),
            "activity_type": round(self.activity_type_score, 4),
            "identifier": round(self.identifier_score, 4),
            "temporal": round(self.temporal_score, 4),
            "dependency": round(self.dependency_score, 4),
            "aggregate_context": round(self.aggregate_context_score, 4),
        }


@dataclass
class RerankedCandidateMatch:
    """
    Represents a candidate match after Contextual Matching & Reranking with detailed component scores,
    final score, calibrated confidence score, final rank, and explainable matching reasons.
    """
    activity_id: str
    activity_db_id: str
    activity_name: str
    original_retrieval_scores: Dict[str, Any]
    contextual_feature_scores: Dict[str, float]
    final_score: float
    final_rank: int
    confidence_score: float
    matching_reasons: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "activity_id": self.activity_id,
            "activity_db_id": self.activity_db_id,
            "activity_name": self.activity_name,
            "schedule_activity_id": self.activity_db_id,
            "name": self.activity_name,
            "original_retrieval_scores": self.original_retrieval_scores,
            "contextual_feature_scores": self.contextual_feature_scores,
            "final_score": round(self.final_score, 6),
            "final_rank": self.final_rank,
            "confidence_score": round(self.confidence_score, 4),
            "matching_reasons": self.matching_reasons,
            "metadata": self.metadata,
        }


@dataclass
class HybridRetrievalResult:
    """
    Container for the final candidate retrieval output for Stage 1.
    """
    evidence_id: str
    raw_text: str
    matches: List[CandidateMatch]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "evidence_id": self.evidence_id,
            "raw_text": self.raw_text,
            "matches": [match.to_dict() for match in self.matches],
        }


@dataclass
class RerankResult:
    """
    Container for the output of Stage 2 Contextual Reranking.
    """
    evidence_id: str
    raw_text: str
    matches: List[RerankedCandidateMatch]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "evidence_id": self.evidence_id,
            "raw_text": self.raw_text,
            "matches": [match.to_dict() for match in self.matches],
        }


