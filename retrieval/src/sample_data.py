"""
Sample dataset and runner script for Hybrid Candidate Retrieval & Contextual Reranking.
"""

from typing import List
import json
from .models import ScheduleActivity, FieldEvidence
from .retrieval_service import HybridRetrievalService


SAMPLE_SCHEDULE_ACTIVITIES: List[ScheduleActivity] = [
    ScheduleActivity(
        id="act_001",
        activity_id="ACT-101",
        name="Site Excavation and Earthwork for Foundation Pier P1 & P2",
        level=2,
        metadata={
            "zone": "North Wing",
            "discipline": "Civil",
            "asset": "Pier P1",
            "wbs_path": "1.1.1",
            "activity_type": "Excavation",
            "planned_start_date": "2026-08-15",
            "planned_end_date": "2026-08-30",
        },
    ),
    ScheduleActivity(
        id="act_002",
        activity_id="ACT-102",
        name="Foundation Pier P1 Rebar Cage Assembly and Placement",
        level=3,
        metadata={
            "zone": "North Wing",
            "discipline": "Civil",
            "asset": "Pier P1",
            "wbs_path": "1.1.2",
            "activity_type": "Rebar & Formwork",
            "planned_start_date": "2026-09-01",
            "planned_end_date": "2026-09-05",
        },
    ),
    ScheduleActivity(
        id="act_003",
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
    ),
    ScheduleActivity(
        id="act_004",
        activity_id="ACT-201",
        name="Substructure Column C1 Formwork and Rebar Fixing",
        level=2,
        metadata={
            "zone": "Central Block",
            "discipline": "Civil",
            "asset": "Column C1",
            "wbs_path": "1.2.1",
            "activity_type": "Rebar & Formwork",
            "planned_start_date": "2026-09-01",
            "planned_end_date": "2026-09-07",
        },
    ),
    ScheduleActivity(
        id="act_005",
        activity_id="ACT-202",
        name="Superstructure Deck Slab Concrete Pouring and Curing - Span 1",
        level=2,
        metadata={
            "zone": "Span 1",
            "discipline": "Civil",
            "asset": "Slab",
            "wbs_path": "1.2.2",
            "activity_type": "Concreting",
            "planned_start_date": "2026-09-01",
            "planned_end_date": "2026-09-05",
        },
    ),
    ScheduleActivity(
        id="act_006",
        activity_id="ACT-301",
        name="Stormwater Drainage Pipe Installation L1 North Section",
        level=2,
        metadata={
            "zone": "Perimeter",
            "discipline": "Piping & Utilities",
            "asset": "Stormwater Drain",
            "wbs_path": "1.3.1",
            "activity_type": "Drainage Installation",
            "planned_start_date": "2026-09-01",
            "planned_end_date": "2026-09-10",
        },
    ),
    ScheduleActivity(
        id="act_007",
        activity_id="ACT-302",
        name="Substation Wall Electrical Conduit Installation & Cable Trenching",
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
    ),
    ScheduleActivity(
        id="act_008",
        activity_id="ACT-401",
        name="Structural Steel Girder Erection and Alignment - Span 2",
        level=2,
        metadata={
            "zone": "Span 2",
            "discipline": "Structural",
            "asset": "Girder",
            "wbs_path": "1.4.1",
            "activity_type": "Structural Erection",
            "planned_start_date": "2026-09-05",
            "planned_end_date": "2026-09-12",
        },
    ),
]


SAMPLE_FIELD_EVIDENCE: List[FieldEvidence] = [
    FieldEvidence(
        id="ev_001",
        raw_text="completed concreting work for pier P2 today around 4pm with 35m3 slump concrete",
        extracted_date="2026-09-03",
        event_type="COMPLETED",
    ),
    FieldEvidence(
        id="ev_002",
        raw_text="excavation work ongoing for L1 stormwater drain north perimeter section",
        extracted_date="2026-09-03",
        event_type="PROGRESS",
    ),
    FieldEvidence(
        id="ev_003",
        raw_text="rebar cage tying and fixing for pier 1 foundation almost done",
        extracted_date="2026-09-03",
        event_type="PROGRESS",
    ),
    FieldEvidence(
        id="ev_004",
        raw_text="finished slab concrete pour for span 1 deck superstructure",
        extracted_date="2026-09-03",
        event_type="COMPLETED",
    ),
]


def run_demo():
    print("=" * 85)
    print("HYBRID CANDIDATE RETRIEVAL & CONTEXTUAL RERANKING DEMO (Stage 1 & Stage 2)")
    print("=" * 85)

    service = HybridRetrievalService()
    print(f"\n[+] Indexing {len(SAMPLE_SCHEDULE_ACTIVITIES)} schedule activities...")
    service.index_activities(SAMPLE_SCHEDULE_ACTIVITIES)
    print("[+] Indexing complete.\n")

    for evidence in SAMPLE_FIELD_EVIDENCE:
        print("=" * 85)
        print(f"EVIDENCE [{evidence.id}] (Date: {evidence.extracted_date}): \"{evidence.raw_text}\"")
        print("=" * 85)

        # Stage 1: Initial Hybrid Candidate Retrieval
        stage1_res = service.retrieve_for_evidence(evidence, top_k=3)
        print("\n--- [STAGE 1] Top RRF Candidates (BM25 + FAISS Vector) ---")
        for match in stage1_res.matches:
            print(
                f" Rank {match.rank} | Code: {match.activity_code:7} | RRF Score: {match.rrf_score:.6f} "
                f"| BM25 Score: {match.bm25_score:6.3f} (Rank {match.bm25_rank}) "
                f"| Vector Sim: {match.vector_score:6.3f} (Rank {match.vector_rank})"
            )
            print(f"   Name: {match.activity_name}")

        # Stage 2: Contextual Matching & Reranking
        rerank_res = service.retrieve_and_rerank(evidence, top_k=3)
        print("\n--- [STAGE 2] Contextual Reranked Matches ---")
        for match in rerank_res.matches:
            print(
                f" Final Rank {match.final_rank} | Code: {match.activity_id:7} "
                f"| Final Score: {match.final_score:.6f} | Confidence: {match.confidence_score*100:5.1f}%"
            )
            print(f"   Name: {match.activity_name}")
            print(f"   Context Feature Breakdown: {json.dumps(match.contextual_feature_scores)}")
            print("   Matching Reasons:")
            for reason in match.matching_reasons:
                print(f"     - {reason}")
            print()


if __name__ == "__main__":
    run_demo()
