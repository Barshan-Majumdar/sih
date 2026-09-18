"""
Benchmark Evaluation Runner comparing Retrieval Performance Before vs After Terminology Normalization.
Evaluates Recall@1, Recall@5, Recall@10, Top-1 Accuracy, Precision@1, and MRR across 86 noisy field evidence queries.
"""

import time
import sys
import os
from typing import List, Dict, Any, Tuple
import json

try:
    from apps.retrieval.src.retrieval_service import HybridRetrievalService
    from apps.retrieval.src.models import FieldEvidence
    from apps.retrieval.benchmark.benchmark_dataset import (
        BENCHMARK_SCHEDULE_ACTIVITIES,
        BENCHMARK_TEST_QUERIES,
        BenchmarkQuery,
    )
except ImportError:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from src.retrieval_service import HybridRetrievalService
    from src.models import FieldEvidence
    from benchmark.benchmark_dataset import (
        BENCHMARK_SCHEDULE_ACTIVITIES,
        BENCHMARK_TEST_QUERIES,
        BenchmarkQuery,
    )


def evaluate_benchmark_pipeline() -> Dict[str, Any]:
    print("=" * 95)
    print("BENCHMARK EVALUATION — TERMINOLOGY NORMALIZATION & RETRIEVAL PIPELINE")
    print(f"Corpus: {len(BENCHMARK_SCHEDULE_ACTIVITIES)} Schedule Activities | Test Suite: {len(BENCHMARK_TEST_QUERIES)} Field Evidence Queries")
    print("=" * 95)

    # 1. Initialize Baseline (No Normalization) and Normalized Service
    t0 = time.time()
    service_raw = HybridRetrievalService(use_normalization=False)
    service_raw.index_activities(BENCHMARK_SCHEDULE_ACTIVITIES)

    service_norm = HybridRetrievalService(use_normalization=True)
    service_norm.index_activities(BENCHMARK_SCHEDULE_ACTIVITIES)
    index_time = (time.time() - t0) * 1000
    print(f"\n[+] Successfully indexed {len(BENCHMARK_SCHEDULE_ACTIVITIES)} activities into both services in {index_time:.2f} ms.\n")

    total_queries = len(BENCHMARK_TEST_QUERIES)

    # Counters: Stage 1 Raw, Stage 1 Norm, Stage 2 Raw, Stage 2 Norm
    # Counters: Stage 1 Raw, Stage 1 Norm, Stage 2 Raw, Stage 2 Norm
    stats = {
        "s1_raw": {"top1": 0, "top5": 0, "top10": 0, "rr": [], "autolink_attempted": 0, "autolink_correct": 0},
        "s1_norm": {"top1": 0, "top5": 0, "top10": 0, "rr": [], "autolink_attempted": 0, "autolink_correct": 0},
        "s2_raw": {"top1": 0, "top5": 0, "top10": 0, "rr": [], "autolink_attempted": 0, "autolink_correct": 0},
        "s2_norm": {"top1": 0, "top5": 0, "top10": 0, "rr": [], "autolink_attempted": 0, "autolink_correct": 0},
    }

    category_stats: Dict[str, Dict[str, Any]] = {}

    for q in BENCHMARK_TEST_QUERIES:
        cat = q.noise_category
        if cat not in category_stats:
            category_stats[cat] = {
                "total": 0,
                "s1_raw_top1": 0, "s1_norm_top1": 0,
                "s2_raw_top1": 0, "s2_norm_top1": 0,
                "s1_raw_top5": 0, "s1_norm_top5": 0,
                "s2_raw_top5": 0, "s2_norm_top5": 0,
            }
        category_stats[cat]["total"] += 1

        ev_raw = FieldEvidence(id=q.query_id, raw_text=q.field_evidence, extracted_date=q.extracted_date)
        ev_norm = FieldEvidence(id=q.query_id, raw_text=q.field_evidence, extracted_date=q.extracted_date)

        # ── 1. Stage 1 Raw ──
        res_s1_raw = service_raw.retrieve_for_evidence(ev_raw, top_k=10, candidate_depth=20)
        r1_raw = next((m.rank for m in res_s1_raw.matches if m.activity_id == q.target_activity_id), None)
        if r1_raw == 1:
            stats["s1_raw"]["top1"] += 1
            category_stats[cat]["s1_raw_top1"] += 1
        if r1_raw and r1_raw <= 5:
            stats["s1_raw"]["top5"] += 1
            category_stats[cat]["s1_raw_top5"] += 1
        if r1_raw and r1_raw <= 10:
            stats["s1_raw"]["top10"] += 1
        stats["s1_raw"]["rr"].append(1.0 / r1_raw if r1_raw else 0.0)

        # Stage 1 Raw Auto-Link check: margin >= 0.12 & rrf >= 0.025
        if len(res_s1_raw.matches) > 0:
            top_m = res_s1_raw.matches[0]
            second_score = res_s1_raw.matches[1].rrf_score if len(res_s1_raw.matches) > 1 else 0.0
            margin = (top_m.rrf_score - second_score) / top_m.rrf_score if top_m.rrf_score > 0 else 0
            if margin >= 0.12 and top_m.rrf_score >= 0.025:
                stats["s1_raw"]["autolink_attempted"] += 1
                if top_m.activity_id == q.target_activity_id:
                    stats["s1_raw"]["autolink_correct"] += 1

        # ── 2. Stage 1 Normalized ──
        res_s1_norm = service_norm.retrieve_for_evidence(ev_norm, top_k=10, candidate_depth=20)
        r1_norm = next((m.rank for m in res_s1_norm.matches if m.activity_id == q.target_activity_id), None)
        if r1_norm == 1:
            stats["s1_norm"]["top1"] += 1
            category_stats[cat]["s1_norm_top1"] += 1
        if r1_norm and r1_norm <= 5:
            stats["s1_norm"]["top5"] += 1
            category_stats[cat]["s1_norm_top5"] += 1
        if r1_norm and r1_norm <= 10:
            stats["s1_norm"]["top10"] += 1
        stats["s1_norm"]["rr"].append(1.0 / r1_norm if r1_norm else 0.0)

        # Stage 1 Norm Auto-Link check
        if len(res_s1_norm.matches) > 0:
            top_m = res_s1_norm.matches[0]
            second_score = res_s1_norm.matches[1].rrf_score if len(res_s1_norm.matches) > 1 else 0.0
            margin = (top_m.rrf_score - second_score) / top_m.rrf_score if top_m.rrf_score > 0 else 0
            if margin >= 0.12 and top_m.rrf_score >= 0.025:
                stats["s1_norm"]["autolink_attempted"] += 1
                if top_m.activity_id == q.target_activity_id:
                    stats["s1_norm"]["autolink_correct"] += 1

        # ── 3. Stage 2 Raw Rerank ──
        res_s2_raw = service_raw.retrieve_and_rerank(ev_raw, explicit_context=q.explicit_context, top_k=10, candidate_depth=20)
        r2_raw = next((m.final_rank for m in res_s2_raw.matches if m.activity_id == q.target_activity_id or m.activity_db_id == q.target_activity_id), None)
        if r2_raw == 1:
            stats["s2_raw"]["top1"] += 1
            category_stats[cat]["s2_raw_top1"] += 1
        if r2_raw and r2_raw <= 5:
            stats["s2_raw"]["top5"] += 1
            category_stats[cat]["s2_raw_top5"] += 1
        if r2_raw and r2_raw <= 10:
            stats["s2_raw"]["top10"] += 1
        stats["s2_raw"]["rr"].append(1.0 / r2_raw if r2_raw else 0.0)

        # Stage 2 Raw Auto-Link check: confidence >= 0.80 & score margin >= 0.03
        if len(res_s2_raw.matches) > 0:
            top_m = res_s2_raw.matches[0]
            second_score = res_s2_raw.matches[1].final_score if len(res_s2_raw.matches) > 1 else 0.0
            margin = top_m.final_score - second_score
            if top_m.confidence_score >= 0.80 and margin >= 0.03:
                stats["s2_raw"]["autolink_attempted"] += 1
                if top_m.activity_id == q.target_activity_id or top_m.activity_db_id == q.target_activity_id:
                    stats["s2_raw"]["autolink_correct"] += 1

        # ── 4. Stage 2 Normalized Rerank ──
        res_s2_norm = service_norm.retrieve_and_rerank(ev_norm, explicit_context=q.explicit_context, top_k=10, candidate_depth=20)
        r2_norm = next((m.final_rank for m in res_s2_norm.matches if m.activity_id == q.target_activity_id or m.activity_db_id == q.target_activity_id), None)
        if r2_norm == 1:
            stats["s2_norm"]["top1"] += 1
            category_stats[cat]["s2_norm_top1"] += 1
        if r2_norm and r2_norm <= 5:
            stats["s2_norm"]["top5"] += 1
            category_stats[cat]["s2_norm_top5"] += 1
        if r2_norm and r2_norm <= 10:
            stats["s2_norm"]["top10"] += 1
        stats["s2_norm"]["rr"].append(1.0 / r2_norm if r2_norm else 0.0)

        # Stage 2 Norm Auto-Link check
        if len(res_s2_norm.matches) > 0:
            top_m = res_s2_norm.matches[0]
            second_score = res_s2_norm.matches[1].final_score if len(res_s2_norm.matches) > 1 else 0.0
            margin = top_m.final_score - second_score
            if top_m.confidence_score >= 0.80 and margin >= 0.03:
                stats["s2_norm"]["autolink_attempted"] += 1
                if top_m.activity_id == q.target_activity_id or top_m.activity_db_id == q.target_activity_id:
                    stats["s2_norm"]["autolink_correct"] += 1

    # Compute overall summary metrics
    def calc_metrics(st):
        top1_acc = (st["top1"] / total_queries) * 100
        rec5 = (st["top5"] / total_queries) * 100
        rec10 = (st["top10"] / total_queries) * 100
        mrr = sum(st["rr"]) / total_queries
        autolink_cov = (st["autolink_attempted"] / total_queries) * 100
        autolink_prec = (st["autolink_correct"] / st["autolink_attempted"] * 100) if st["autolink_attempted"] > 0 else 100.0
        return top1_acc, rec5, rec10, mrr, autolink_prec, autolink_cov

    m_s1_raw = calc_metrics(stats["s1_raw"])
    m_s1_norm = calc_metrics(stats["s1_norm"])
    m_s2_raw = calc_metrics(stats["s2_raw"])
    m_s2_norm = calc_metrics(stats["s2_norm"])

    print("=" * 105)
    print("RETRIEVAL EVALUATION BEFORE VS AFTER TERMINOLOGY NORMALIZATION")
    print("=" * 105)
    print(f"{'Metric':<25} | {'Stage 1 (Raw)':<17} | {'Stage 1 (Norm)':<17} | {'Stage 2 (Raw)':<17} | {'Stage 2 (Norm)':<17}")
    print("-" * 105)
    print(f"{'Auto-Link Precision':<25} | {m_s1_raw[4]:>15.2f}% | {m_s1_norm[4]:>15.2f}% | {m_s2_raw[4]:>15.2f}% | {m_s2_norm[4]:>15.2f}%")
    print(f"{'Auto-Link Coverage':<25} | {m_s1_raw[5]:>15.2f}% | {m_s1_norm[5]:>15.2f}% | {m_s2_raw[5]:>15.2f}% | {m_s2_norm[5]:>15.2f}%")
    print(f"{'Top-1 Accuracy':<25} | {m_s1_raw[0]:>15.2f}% | {m_s1_norm[0]:>15.2f}% | {m_s2_raw[0]:>15.2f}% | {m_s2_norm[0]:>15.2f}%")
    print(f"{'Recall@1':<25} | {m_s1_raw[0]:>15.2f}% | {m_s1_norm[0]:>15.2f}% | {m_s2_raw[0]:>15.2f}% | {m_s2_norm[0]:>15.2f}%")
    print(f"{'Recall@5':<25} | {m_s1_raw[1]:>15.2f}% | {m_s1_norm[1]:>15.2f}% | {m_s2_raw[1]:>15.2f}% | {m_s2_norm[1]:>15.2f}%")
    print(f"{'Recall@10':<25} | {m_s1_raw[2]:>15.2f}% | {m_s1_norm[2]:>15.2f}% | {m_s2_raw[2]:>15.2f}% | {m_s2_norm[2]:>15.2f}%")
    print(f"{'Mean Reciprocal Rank':<25} | {m_s1_raw[3]:>17.4f} | {m_s1_norm[3]:>17.4f} | {m_s2_raw[3]:>17.4f} | {m_s2_norm[3]:>17.4f}")
    print("=" * 105)

    # Category Breakdown Table
    print("\nCATEGORY-WISE TOP-1 ACCURACY COMPARISON:")
    print("-" * 105)
    print(f"{'Category':<20} | {'Count':<5} | {'Stg 1 Raw':<13} | {'Stg 1 Norm':<13} | {'Stg 2 Raw':<13} | {'Stg 2 Norm':<13}")
    print("-" * 105)
    for cat, cst in sorted(category_stats.items()):
        cnt = cst["total"]
        s1r = (cst["s1_raw_top1"] / cnt) * 100
        s1n = (cst["s1_norm_top1"] / cnt) * 100
        s2r = (cst["s2_raw_top1"] / cnt) * 100
        s2n = (cst["s2_norm_top1"] / cnt) * 100
        print(f"{cat:<20} | {cnt:<5} | {s1r:>11.1f}% | {s1n:>11.1f}% | {s2r:>11.1f}% | {s2n:>11.1f}%")
    print("-" * 105)

    return {
        "s1_raw": m_s1_raw,
        "s1_norm": m_s1_norm,
        "s2_raw": m_s2_raw,
        "s2_norm": m_s2_norm,
        "category_stats": category_stats,
    }


if __name__ == "__main__":
    evaluate_benchmark_pipeline()
