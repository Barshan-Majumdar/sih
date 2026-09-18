"""
FastAPI REST Microservice for Hybrid Candidate Retrieval & Contextual Reranking.
Exposes endpoints for indexing schedule activities, normalizing field text,
and running Stage 1 & Stage 2 matching.
"""

from typing import List, Dict, Any, Optional
import time
from fastapi import FastAPI, HTTPException, Query, Body
from pydantic import BaseModel, Field

from .models import (
    ScheduleActivity,
    FieldEvidence,
    EvidenceContext,
    CandidateMatch,
    RerankedCandidateMatch,
)
from .retrieval_service import HybridRetrievalService
from .terminology_normalizer import TerminologyNormalizer
from .extraction import build_extraction_router


# ──────────────────────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────────────────────

class ActivityMetadataDTO(BaseModel):
    zone: Optional[str] = None
    discipline: Optional[str] = None
    asset: Optional[str] = None
    wbs_path: Optional[str] = None
    activity_type: Optional[str] = None
    planned_start_date: Optional[str] = None
    planned_end_date: Optional[str] = None
    description: Optional[str] = None


class ScheduleActivityDTO(BaseModel):
    id: str
    activity_id: str
    name: str
    level: int = 1
    parent_id: Optional[str] = None
    planned_start_date: Optional[str] = None
    planned_end_date: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    predecessors: List[str] = Field(default_factory=list)
    successors: List[str] = Field(default_factory=list)
    status: Optional[str] = None


class IndexActivitiesRequest(BaseModel):
    activities: List[ScheduleActivityDTO]


class NormalizeTextRequest(BaseModel):
    text: str
    append_original: bool = True


class FieldEvidenceDTO(BaseModel):
    id: str = "EV-001"
    raw_text: str
    extracted_date: Optional[str] = None
    event_type: Optional[str] = None
    normalized_text: Optional[str] = None


class EvidenceContextDTO(BaseModel):
    discipline: Optional[str] = None
    location: Optional[str] = None
    asset: Optional[str] = None
    wbs_path: Optional[str] = None
    activity_type: Optional[str] = None
    identifiers: List[str] = Field(default_factory=list)
    extracted_date: Optional[str] = None
    detected_disciplines: List[str] = Field(default_factory=list)


class MatchRequest(BaseModel):
    evidence: FieldEvidenceDTO
    explicit_context: Optional[EvidenceContextDTO] = None
    top_k: int = 5
    candidate_depth: int = 20
    rrf_k: int = 60


# ──────────────────────────────────────────────────────────────
# FastAPI App & Service Initialization
# ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Hybrid Candidate Retrieval & Contextual Reranking API",
    description="High-performance API microservice for matching construction field evidence to WBS schedule activities.",
    version="1.0.0",
)

service = HybridRetrievalService(use_normalization=True)
app.include_router(build_extraction_router())


@app.get("/health")
def health_check():
    """
    Returns server status and total indexed schedule activities.
    """
    return {
        "status": "online",
        "indexed_activities_count": len(service.activities),
        "normalization_enabled": service.use_normalization,
    }


@app.post("/api/retrieval/index")
def index_activities(req: IndexActivitiesRequest):
    """
    Indexes schedule activities into BM25 and FAISS retrievers.
    """
    domain_activities = [
        ScheduleActivity(
            id=act.id,
            activity_id=act.activity_id,
            name=act.name,
            level=act.level,
            parent_id=act.parent_id,
            planned_start_date=act.planned_start_date,
            planned_end_date=act.planned_end_date,
            metadata=act.metadata,
            predecessors=act.predecessors,
            successors=act.successors,
            status=act.status,
        )
        for act in req.activities
    ]

    t0 = time.time()
    service.index_activities(domain_activities)
    elapsed_ms = (time.time() - t0) * 1000

    return {
        "status": "success",
        "indexed_count": len(service.activities),
        "elapsed_ms": round(elapsed_ms, 2),
    }


@app.post("/api/retrieval/normalize")
def normalize_text(req: NormalizeTextRequest):
    """
    Normalizes field text using construction terminology normalizer with discipline tagging.
    """
    normalized = service.normalizer.normalize_text(
        req.text, append_original=req.append_original
    )
    disciplines = service.normalizer.get_discipline_tags(req.text)
    return {
        "raw_text": req.text,
        "normalized_text": normalized,
        "discipline_tags": disciplines,
    }


@app.post("/api/retrieval/stage1")
def stage1_retrieval(req: MatchRequest):
    """
    Executes Stage 1 Hybrid Retrieval (BM25 + FAISS + RRF) with Terminology Normalization.
    """
    evidence = FieldEvidence(
        id=req.evidence.id,
        raw_text=req.evidence.raw_text,
        extracted_date=req.evidence.extracted_date,
        event_type=req.evidence.event_type,
        normalized_text=req.evidence.normalized_text,
    )

    res = service.retrieve_for_evidence(
        evidence=evidence,
        top_k=req.top_k,
        candidate_depth=req.candidate_depth,
        rrf_k=req.rrf_k,
    )

    return res.to_dict()


@app.post("/api/retrieval/match")
def full_pipeline_match(req: MatchRequest):
    """
    Executes complete pipeline:
    Terminology Normalization -> Stage 1 Hybrid Retrieval -> Stage 2 Contextual Reranking.
    """
    evidence = FieldEvidence(
        id=req.evidence.id,
        raw_text=req.evidence.raw_text,
        extracted_date=req.evidence.extracted_date,
        event_type=req.evidence.event_type,
        normalized_text=req.evidence.normalized_text,
    )

    explicit_ctx = None
    if req.explicit_context:
        explicit_ctx = EvidenceContext(
            discipline=req.explicit_context.discipline,
            location=req.explicit_context.location,
            asset=req.explicit_context.asset,
            wbs_path=req.explicit_context.wbs_path,
            activity_type=req.explicit_context.activity_type,
            identifiers=req.explicit_context.identifiers,
            extracted_date=req.explicit_context.extracted_date,
            detected_disciplines=req.explicit_context.detected_disciplines,
        )

    t0 = time.time()
    res = service.retrieve_and_rerank(
        evidence=evidence,
        explicit_context=explicit_ctx,
        top_k=req.top_k,
        candidate_depth=req.candidate_depth,
        rrf_k=req.rrf_k,
    )
    elapsed_ms = (time.time() - t0) * 1000

    out = res.to_dict()
    out["elapsed_ms"] = round(elapsed_ms, 2)
    out["normalized_text"] = evidence.normalized_text
    return out
