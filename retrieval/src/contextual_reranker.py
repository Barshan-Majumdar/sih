"""
Contextual Matching & Reranking module for Hybrid Candidate Retrieval.

Reranks Stage 1 (BM25 + FAISS + RRF) Top-K candidate matches by evaluating contextual compatibility
across metadata signals: discipline, location/area, asset, WBS hierarchy, activity type,
identifiers/entities, and temporal constraints with adaptive query weighting and conflict penalization.
"""

from typing import List, Dict, Any, Optional, Tuple
import re
from datetime import datetime
import math

from .models import (
    ScheduleActivity,
    FieldEvidence,
    CandidateMatch,
    EvidenceContext,
    ContextualFeatureScores,
    RerankedCandidateMatch,
    RerankResult,
)


DEFAULT_FEATURE_WEIGHTS: Dict[str, float] = {
    "discipline": 0.15,
    "location": 0.18,
    "asset": 0.15,
    "wbs": 0.10,
    "activity_type": 0.15,
    "identifier": 0.14,
    "temporal": 0.06,
    "dependency": 0.06,
}

# Explicit entity conflict pairs: (Pattern A, Pattern B)
ENTITY_CONFLICT_FAMILIES = [
    (r"\b(p1|pier\s*1|pier\s*p1)\b", r"\b(p2|pier\s*2|pier\s*p2)\b"),
    (r"\b(span\s*1)\b", r"\b(span\s*2)\b"),
    (r"\b(c1|column\s*1|column\s*c1)\b", r"\b(c2|column\s*2|column\s*c2)\b"),
    (r"\b(level\s*1|lvl\s*1|floor\s*1)\b", r"\b(level\s*2|lvl\s*2|floor\s*2)\b"),
    (r"\b(tower\s*a)\b", r"\b(tower\s*b)\b"),
    (r"\b(zone\s*a)\b", r"\b(zone\s*b)\b"),
    (r"\b(abutment\s*a)\b", r"\b(abutment\s*b)\b"),
]


class ContextualReranker:
    """
    Modular Contextual Reranker that evaluates candidate schedule activities against
    unstructured field evidence context and returns re-ranked matches with confidence
    scores and human-readable matching reasons.
    """

    def __init__(
        self,
        feature_weights: Optional[Dict[str, float]] = None,
        default_retrieval_weight: float = 0.50,
        default_context_weight: float = 0.50,
        normalizer: Optional[Any] = None,
    ):
        self.feature_weights = feature_weights or dict(DEFAULT_FEATURE_WEIGHTS)
        self.default_retrieval_weight = default_retrieval_weight
        self.default_context_weight = default_context_weight
        self.normalizer = normalizer

        # Normalize feature weights so they sum to 1.0
        total_weight = sum(self.feature_weights.values())
        if total_weight > 0:
            self.feature_weights = {
                k: v / total_weight for k, v in self.feature_weights.items()
            }

    def compute_adaptive_weights(
        self, candidate_matches: List[CandidateMatch]
    ) -> Tuple[float, float, float]:
        """
        Dynamically calculates retrieval_weight and context_weight based on Stage 1 RRF margin.
        Returns: (adaptive_retrieval_weight, adaptive_context_weight, rrf_margin)
        """
        if len(candidate_matches) < 2:
            return (0.80, 0.20, 1.0)

        top1_rrf = candidate_matches[0].rrf_score
        top2_rrf = candidate_matches[1].rrf_score

        if top1_rrf <= 0:
            return (0.50, 0.50, 0.0)

        # Margin normalized relative to top 1 score
        margin = (top1_rrf - top2_rrf) / top1_rrf

        # High Stage 1 consensus (clear winner) -> High retrieval weight (0.70 to 0.85)
        if margin >= 0.15:
            retrieval_w = 0.70 + 0.15 * min(1.0, (margin - 0.15) / 0.25)
        elif margin >= 0.05:
            # Moderate consensus -> retrieval weight 0.55 to 0.70
            retrieval_w = 0.55 + 0.15 * ((margin - 0.05) / 0.10)
        else:
            # Close competition / low consensus -> lower retrieval weight (0.35 to 0.55) to allow context disambiguation
            retrieval_w = 0.35 + 0.20 * (margin / 0.05)

        retrieval_w = min(0.85, max(0.35, retrieval_w))
        context_w = 1.0 - retrieval_w
        return (retrieval_w, context_w, margin)

    def extract_context_from_evidence(
        self, evidence: FieldEvidence
    ) -> EvidenceContext:
        """
        Automatically infer structured context from raw field evidence text if not explicitly provided.
        """
        text = evidence.raw_text
        text_lower = text.lower()

        # 1. Identifiers: ACT-xxx, P1, P2, C1, L1, Span 1, etc.
        identifiers = set()
        for match in re.findall(
            r"\b(ACT-\d+|P\d+|C\d+|L\d+|Span\s*\d+|Zone\s*\w+|Substation\s*\w+|Tower\s*\w+|Abutment\s*\w+)\b",
            text,
            re.IGNORECASE,
        ):
            identifiers.add(match.upper())

        # 2. Activity Type keywords
        activity_type = None
        if any(w in text_lower for w in ["concreting", "pouring", "pour", "slump"]):
            activity_type = "Concreting"
        elif any(w in text_lower for w in ["excavation", "earthwork", "trenching", "digging"]):
            activity_type = "Excavation"
        elif any(w in text_lower for w in ["rebar", "cage", "tying", "steel fixing", "formwork", "shuttering"]):
            activity_type = "Rebar & Formwork"
        elif any(w in text_lower for w in ["electrical", "substation", "conduit installation", "conduit"]):
            activity_type = "Electrical Installation"
        elif any(w in text_lower for w in ["pipe", "drainage", "stormwater", "drain", "sewer"]):
            activity_type = "Drainage Installation"
        elif any(w in text_lower for w in ["erection", "girder", "alignment", "bolting"]):
            activity_type = "Structural Erection"
        elif any(w in text_lower for w in ["plastering", "masonry", "plaster", "blockwork", "block"]):
            activity_type = "Masonry & Plastering"
        elif any(w in text_lower for w in ["glazing", "curtain wall", "aluminium frame"]):
            activity_type = "Glazing & Facade"
        elif any(w in text_lower for w in ["waterproofing", "membrane", "bitumen"]):
            activity_type = "Waterproofing"
        elif any(w in text_lower for w in ["asphalt", "paving", "bituminous"]):
            activity_type = "Paving"

        # 3. Discipline keywords & Glossary discipline tags
        discipline = None
        detected_disciplines = []
        if self.normalizer and hasattr(self.normalizer, "get_discipline_tags"):
            detected_disciplines = self.normalizer.get_discipline_tags(text)
            if detected_disciplines:
                discipline = detected_disciplines[0]

        if not discipline:
            if any(w in text_lower for w in ["concreting", "rebar", "formwork", "excavation", "pier", "column", "slab", "foundation", "plastering", "masonry", "blockwork", "asphalt", "paving", "waterproofing"]):
                discipline = "Civil"
            elif any(w in text_lower for w in ["electrical", "substation", "cable trenching", "conduit"]):
                discipline = "Electrical"
            elif any(w in text_lower for w in ["pipe", "drainage", "stormwater", "sewer", "ductwork", "hvac", "sprinkler"]):
                discipline = "Piping & Utilities"
            elif any(w in text_lower for w in ["girder", "structural steel", "steel frame", "glazing", "curtain wall"]):
                discipline = "Structural"

        # 4. Location / Area
        location = None
        loc_match = re.search(
            r"\b(north wing|central block|span \d+|perimeter|utilities|zone \d+|pier p\d+|abutment \w+|tower \w+)\b",
            text_lower,
        )
        if loc_match:
            location = loc_match.group(1).title()

        # 5. Asset
        asset = None
        asset_match = re.search(
            r"\b(pier p\d+|column c\d+|slab|stormwater drain|sewer main|substation|girder|abutment \w+|tower \w+)\b",
            text_lower,
        )
        if asset_match:
            asset = asset_match.group(1).title()

        # 6. WBS Path Context Extraction
        wbs_path = None
        wbs_match = re.search(r"\b(?:wbs\s*[:#]?\s*)?(\d+\.\d+(?:\.\d+)*)\b", text, re.IGNORECASE)
        if wbs_match:
            wbs_path = wbs_match.group(1)

        return EvidenceContext(
            discipline=discipline,
            location=location,
            asset=asset,
            wbs_path=wbs_path,
            activity_type=activity_type,
            identifiers=list(identifiers),
            extracted_date=evidence.extracted_date,
            detected_disciplines=detected_disciplines,
        )

    # ──────────────────────────────────────────────────────────────
    # Entity Conflict Detector
    # ──────────────────────────────────────────────────────────────

    def check_entity_conflict(
        self, context: EvidenceContext, raw_text: str, activity: ScheduleActivity
    ) -> Tuple[bool, Optional[str]]:
        """
        Checks if the candidate activity explicitly conflicts with an entity token in evidence.
        Example: Evidence specifies 'Span 1', but activity is 'Span 2'.
        """
        identifiers = context.identifiers if context and context.identifiers else []
        ev_identifiers = " ".join(str(i) for i in identifiers if i)
        loc = context.location if context and context.location else ""
        combined_ev = f"{raw_text or ''} {ev_identifiers} {loc}".lower()

        act_name = activity.name if activity and activity.name else ""
        act_id = activity.activity_id if activity and activity.activity_id else ""
        act_meta = activity.metadata if activity and activity.metadata else ""
        combined_act = f"{act_name} {act_id} {act_meta}".lower()

        for pat_a, pat_b in ENTITY_CONFLICT_FAMILIES:
            m_a_ev = re.search(pat_a, combined_ev)
            m_b_ev = re.search(pat_b, combined_ev)

            # If evidence text contains BOTH terms (e.g. pier 1 and pier 2 excavation), it is a dual reference, NOT a conflict
            if m_a_ev and m_b_ev:
                continue

            # Evidence contains Pattern A, Activity contains Pattern B
            m_b_act = re.search(pat_b, combined_act)
            if m_a_ev and m_b_act:
                match_ev = m_a_ev.group(0)
                match_act = m_b_act.group(0)
                return True, f"Conflict: Evidence specifies '{match_ev.upper()}' but activity is '{match_act.upper()}'"

            # Evidence contains Pattern B, Activity contains Pattern A
            m_a_act = re.search(pat_a, combined_act)
            if m_b_ev and m_a_act:
                match_ev = m_b_ev.group(0)
                match_act = m_a_act.group(0)
                return True, f"Conflict: Evidence specifies '{match_ev.upper()}' but activity is '{match_act.upper()}'"

        return False, None

    # ──────────────────────────────────────────────────────────────
    # Component Matchers (Scoring 0.0 to 1.0 with Conflict Penalties)
    # ──────────────────────────────────────────────────────────────

    def score_discipline(self, context: EvidenceContext, activity: ScheduleActivity) -> float:
        ev_disc = context.discipline
        act_disc = activity.metadata.get("discipline") or activity.metadata.get("trade")

        if not ev_disc:
            return 0.5  # Neutral if context missing

        if not act_disc:
            name_lower = activity.name.lower()
            if any(w in name_lower for w in ["excavation", "rebar", "concrete", "formwork", "pier", "column", "slab", "plastering", "masonry"]):
                act_disc = "Civil"
            elif any(w in name_lower for w in ["electrical", "conduit", "substation"]):
                act_disc = "Electrical"
            elif any(w in name_lower for w in ["drainage", "pipe", "stormwater", "sewer"]):
                act_disc = "Piping & Utilities"
            elif any(w in name_lower for w in ["steel", "girder", "glazing"]):
                act_disc = "Structural"

        if not act_disc:
            return 0.5

        if ev_disc.lower() == act_disc.lower():
            return 1.0
        return 0.0

    def score_location(self, context: EvidenceContext, activity: ScheduleActivity) -> float:
        ev_loc = context.location
        act_zone = activity.metadata.get("zone") or activity.metadata.get("location")

        if not ev_loc:
            return 0.5

        ev_loc_lower = ev_loc.lower()

        # Check explicit metadata match
        if act_zone and ev_loc_lower == str(act_zone).lower():
            return 1.0

        # Check string containment
        act_name_lower = activity.name.lower()
        if ev_loc_lower in act_name_lower or (act_zone and ev_loc_lower in str(act_zone).lower()):
            return 0.95

        # Check partial token match
        ev_tokens = set(ev_loc_lower.split())
        act_tokens = set(act_name_lower.split())
        if act_zone:
            act_tokens.update(str(act_zone).lower().split())

        intersection = ev_tokens.intersection(act_tokens)
        if intersection:
            return len(intersection) / float(len(ev_tokens))

        return 0.0

    def score_asset(self, context: EvidenceContext, activity: ScheduleActivity) -> float:
        ev_asset = context.asset
        act_asset = activity.metadata.get("asset")

        if not ev_asset:
            return 0.5

        ev_asset_lower = ev_asset.lower()

        if act_asset and ev_asset_lower == str(act_asset).lower():
            return 1.0

        if ev_asset_lower in activity.name.lower():
            return 0.95

        ev_tokens = set(ev_asset_lower.split())
        act_tokens = set(activity.name.lower().split())
        intersection = ev_tokens.intersection(act_tokens)
        if intersection:
            return len(intersection) / float(len(ev_tokens))

        return 0.0

    def score_wbs(self, context: EvidenceContext, activity: ScheduleActivity) -> float:
        ev_wbs = context.wbs_path
        act_wbs = activity.metadata.get("wbs_path") or activity.metadata.get("wbs")

        if not ev_wbs or not act_wbs:
            return 0.5

        if ev_wbs == act_wbs:
            return 1.0

        ev_parts = ev_wbs.split(".")
        act_parts = str(act_wbs).split(".")
        common_len = 0
        for p1, p2 in zip(ev_parts, act_parts):
            if p1 == p2:
                common_len += 1
            else:
                break

        max_len = max(len(ev_parts), len(act_parts))
        return common_len / float(max_len) if max_len > 0 else 0.0

    def score_activity_type(self, context: EvidenceContext, activity: ScheduleActivity) -> float:
        ev_type = context.activity_type
        act_type = activity.metadata.get("activity_type")

        if not ev_type:
            return 0.5

        if act_type and ev_type.lower() == str(act_type).lower():
            return 1.0

        name_lower = activity.name.lower()
        type_keywords = {
            "Concreting": ["concrete", "concreting", "pouring", "pour"],
            "Excavation": ["excavation", "earthwork", "trenching", "digging"],
            "Rebar & Formwork": ["rebar", "cage", "formwork", "tying", "fixing", "shuttering"],
            "Electrical Installation": ["electrical", "conduit", "trenching", "cable"],
            "Drainage Installation": ["drainage", "pipe", "installation", "sewer"],
            "Structural Erection": ["erection", "alignment", "girder", "steel", "bolting"],
            "Masonry & Plastering": ["plastering", "masonry", "plaster", "blockwork", "block"],
            "Glazing & Facade": ["glazing", "curtain wall", "framing", "glass"],
            "Waterproofing": ["waterproofing", "membrane", "bitumen"],
            "Paving": ["asphalt", "paving", "bituminous"],
        }

        keywords = type_keywords.get(ev_type, [ev_type.lower()])
        matches = [kw for kw in keywords if kw in name_lower]
        if matches:
            return 1.0 if len(matches) > 1 else 0.85

        return 0.0

    def score_identifiers(self, context: EvidenceContext, activity: ScheduleActivity) -> float:
        ev_ids = context.identifiers

        if not ev_ids:
            return 0.5

        activity_code = activity.activity_id.upper()
        name_upper = activity.name.upper()

        match_count = 0
        for ident in ev_ids:
            ident_clean = ident.strip().upper()
            if ident_clean == activity_code:
                match_count += 2  # Strong match
            elif ident_clean in name_upper or (activity.metadata and ident_clean in str(activity.metadata).upper()):
                match_count += 1

        if match_count >= 2:
            return 1.0
        elif match_count == 1:
            return 0.85
        return 0.0

    def score_temporal(self, context: EvidenceContext, activity: ScheduleActivity) -> float:
        ev_date_str = context.extracted_date
        plan_start_str = activity.metadata.get("planned_start_date")
        plan_end_str = activity.metadata.get("planned_end_date")

        if not ev_date_str or (not plan_start_str and not plan_end_str):
            return 0.5  # Neutral default

        try:
            ev_date = datetime.strptime(ev_date_str, "%Y-%m-%d")
            start_date = datetime.strptime(plan_start_str, "%Y-%m-%d") if plan_start_str else ev_date
            end_date = datetime.strptime(plan_end_str, "%Y-%m-%d") if plan_end_str else start_date

            if start_date <= ev_date <= end_date:
                return 1.0

            if ev_date < start_date:
                diff_days = (start_date - ev_date).days
            else:
                diff_days = (ev_date - end_date).days

            if diff_days <= 3:
                return 0.8
            elif diff_days <= 7:
                return 0.6
            elif diff_days <= 14:
                return 0.4
            else:
                return 0.1
        except Exception:
            return 0.5

    def score_dependencies(
        self,
        context: EvidenceContext,
        activity: ScheduleActivity,
        activities_map: Optional[Dict[str, ScheduleActivity]] = None,
        raw_text: str = "",
    ) -> float:
        """
        Evaluates dependency / prerequisite signals between candidate activity and its predecessors.
        Returns compatibility score 0.0 to 1.0.
        """
        predecessors = activity.predecessors or (activity.metadata.get("predecessors") if activity.metadata else None) or []
        if not predecessors:
            return 0.5  # Neutral default if no predecessors specified

        text_lower = raw_text.lower()

        # Signal 1: Check if text explicitly mentions a predecessor activity or predecessor completion
        # e.g., "completed foundation pit excavation", "after rebar cage assembly"
        for p in predecessors:
            p_str = str(p).lower()
            if p_str in text_lower:
                if any(w in text_lower for w in ["done", "completed", "finish", "finished", "poured", "after", "following", "placed"]):
                    return 0.95
                return 0.85

        # Signal 2: Check recorded status of predecessor activities in activities_map
        if activities_map:
            pred_statuses = []
            for p in predecessors:
                p_str = str(p).upper()
                pred_act = activities_map.get(p) or activities_map.get(p_str)
                if not pred_act:
                    for act in activities_map.values():
                        if act.activity_id.upper() == p_str or act.id.upper() == p_str:
                            pred_act = act
                            break
                if pred_act:
                    status = (pred_act.status or (pred_act.metadata.get("status") if pred_act.metadata else "") or "").upper()
                    pred_statuses.append(status)

            if pred_statuses:
                completed_count = sum(1 for s in pred_statuses if s in ["COMPLETED", "DONE", "FINISHED"])
                in_prog_count = sum(1 for s in pred_statuses if s in ["IN_PROGRESS", "ACTIVE", "STARTED"])
                total = len(pred_statuses)

                if completed_count == total:
                    return 1.0  # All prerequisites complete!
                elif (completed_count + in_prog_count) == total:
                    return 0.75  # Predecessors active or partly done
                elif completed_count > 0:
                    return 0.60
                elif all(s in ["NOT_STARTED", "PENDING"] for s in pred_statuses):
                    return 0.25  # Prerequisite predecessor not started yet

        return 0.5

    # ──────────────────────────────────────────────────────────────
    # Combination & Reranking
    # ──────────────────────────────────────────────────────────────

    def compute_contextual_scores(
        self,
        context: EvidenceContext,
        raw_text: str,
        activity: ScheduleActivity,
        activities_map: Optional[Dict[str, ScheduleActivity]] = None,
    ) -> Tuple[ContextualFeatureScores, bool, Optional[str]]:
        """
        Compute individual feature compatibility scores, evaluate conflict penalties,
        and calculate aggregate context score.
        Returns: (ContextualFeatureScores, has_conflict, conflict_reason)
        """
        disc_s = self.score_discipline(context, activity)
        loc_s = self.score_location(context, activity)
        asset_s = self.score_asset(context, activity)
        wbs_s = self.score_wbs(context, activity)
        type_s = self.score_activity_type(context, activity)
        ident_s = self.score_identifiers(context, activity)
        temp_s = self.score_temporal(context, activity)
        dep_s = self.score_dependencies(context, activity, activities_map, raw_text)

        has_conflict, conflict_reason = self.check_entity_conflict(context, raw_text, activity)

        weights = self.feature_weights
        aggregate = (
            weights.get("discipline", 0.15) * disc_s
            + weights.get("location", 0.18) * loc_s
            + weights.get("asset", 0.15) * asset_s
            + weights.get("wbs", 0.10) * wbs_s
            + weights.get("activity_type", 0.15) * type_s
            + weights.get("identifier", 0.14) * ident_s
            + weights.get("temporal", 0.06) * temp_s
            + weights.get("dependency", 0.06) * dep_s
        )

        # Apply entity conflict penalty if detected
        if has_conflict:
            aggregate = max(0.0, aggregate - 0.40)

        scores = ContextualFeatureScores(
            discipline_score=disc_s,
            location_score=loc_s,
            asset_score=asset_s,
            wbs_score=wbs_s,
            activity_type_score=type_s,
            identifier_score=ident_s,
            temporal_score=temp_s,
            dependency_score=dep_s,
            aggregate_context_score=aggregate,
        )

        return scores, has_conflict, conflict_reason

    def generate_matching_reasons(
        self,
        candidate: CandidateMatch,
        context: EvidenceContext,
        feature_scores: ContextualFeatureScores,
        activity: ScheduleActivity,
        adaptive_r_weight: float,
        adaptive_c_weight: float,
        rrf_margin: float,
        has_conflict: bool,
        conflict_reason: Optional[str],
    ) -> List[str]:
        """
        Generate explainable, human-readable matching reasons.
        """
        reasons = []

        reasons.append(
            f"Adaptive Weights: {adaptive_r_weight*100:.0f}% Retrieval / {adaptive_c_weight*100:.0f}% Context "
            f"(Stage 1 Margin: {rrf_margin:.3f})"
        )

        reasons.append(
            f"Stage 1 RRF Score: {candidate.rrf_score:.6f} "
            f"(BM25 Rank: {candidate.bm25_rank}, Vector Rank: {candidate.vector_rank})"
        )

        if has_conflict and conflict_reason:
            reasons.append(f"⚠ {conflict_reason} (-0.40 Context Penalty)")

        if feature_scores.identifier_score >= 0.8:
            reasons.append(f"Matched code/identifier entity: {candidate.activity_code}")

        if feature_scores.discipline_score >= 0.9 and context.discipline:
            reasons.append(f"Matched discipline: {context.discipline}")

        if feature_scores.location_score >= 0.8:
            loc_name = context.location or activity.metadata.get("zone") or "Zone/Location"
            reasons.append(f"Matched location/area: {loc_name}")

        if feature_scores.activity_type_score >= 0.8 and context.activity_type:
            reasons.append(f"Matched activity type: {context.activity_type}")

        if feature_scores.asset_score >= 0.8 and context.asset:
            reasons.append(f"Matched asset entity: {context.asset}")

        if feature_scores.wbs_score >= 0.8 and context.wbs_path:
            reasons.append(f"WBS hierarchy path aligned: {context.wbs_path}")

        if feature_scores.temporal_score >= 0.9:
            reasons.append("Observation date aligns with activity schedule window")

        if feature_scores.dependency_score >= 0.8:
            reasons.append("Predecessor dependency prerequisites verified and satisfied")
        elif feature_scores.dependency_score <= 0.3:
            reasons.append("⚠ Dependency notice: Predecessor activities not recorded as complete")

        return reasons

    def rerank_candidates(
        self,
        candidate_matches: List[CandidateMatch],
        activities_map: Dict[str, ScheduleActivity],
        evidence: FieldEvidence,
        explicit_context: Optional[EvidenceContext] = None,
        top_k: int = 5,
    ) -> RerankResult:
        """
        Rerank Stage 1 CandidateMatch list using Adaptive Contextual Matching.

        Args:
            candidate_matches: Top-K candidate matches from Stage 1 retrieval.
            activities_map: Dict mapping activity_id to ScheduleActivity object.
            evidence: FieldEvidence object containing raw text and extracted date.
            explicit_context: Optional manually supplied or pre-extracted EvidenceContext.
            top_k: Number of final reranked candidate matches to return.

        Returns:
            RerankResult containing re-ranked list of RerankedCandidateMatch objects.
        """
        if not candidate_matches:
            return RerankResult(evidence_id=evidence.id, raw_text=evidence.raw_text, matches=[])

        # 1. Determine Evidence Context & Adaptive Weights
        context = explicit_context or self.extract_context_from_evidence(evidence)
        r_weight, c_weight, rrf_margin = self.compute_adaptive_weights(candidate_matches)

        # 2. Max RRF score for normalization
        max_rrf = max((m.rrf_score for m in candidate_matches), default=1.0)
        if max_rrf <= 0:
            max_rrf = 1.0

        reranked_tuples: List[Tuple[float, int, bool, RerankedCandidateMatch]] = []

        for candidate in candidate_matches:
            activity = activities_map.get(candidate.activity_id)
            if not activity:
                activity = ScheduleActivity(
                    id=candidate.activity_id,
                    activity_id=candidate.activity_code,
                    name=candidate.activity_name,
                    metadata=candidate.metadata,
                )

            # Feature compatibility scores & conflict check
            feature_scores, has_conflict, conflict_reason = self.compute_contextual_scores(
                context, evidence.raw_text, activity, activities_map
            )

            # Normalized Stage 1 RRF retrieval score (0.0 to 1.0)
            rrf_norm = min(candidate.rrf_score / max_rrf, 1.0)

            # Combined Final Score with Adaptive Weighting
            final_score = (
                r_weight * rrf_norm
                + c_weight * feature_scores.aggregate_context_score
            )

            # Calibrated Confidence Score
            confidence_score = 1.0 / (1.0 + math.exp(-6.0 * (final_score - 0.5)))

            matching_reasons = self.generate_matching_reasons(
                candidate,
                context,
                feature_scores,
                activity,
                r_weight,
                c_weight,
                rrf_margin,
                has_conflict,
                conflict_reason,
            )

            orig_scores = {
                "bm25_score": candidate.bm25_score,
                "vector_score": candidate.vector_score,
                "rrf_score": candidate.rrf_score,
                "original_rank": candidate.rank,
                "bm25_rank": candidate.bm25_rank,
                "vector_rank": candidate.vector_rank,
                "adaptive_retrieval_weight": round(r_weight, 4),
                "adaptive_context_weight": round(c_weight, 4),
                "rrf_margin": round(rrf_margin, 4),
            }

            match_obj = RerankedCandidateMatch(
                activity_id=candidate.activity_code,
                activity_db_id=candidate.activity_id,
                activity_name=candidate.activity_name,
                original_retrieval_scores=orig_scores,
                contextual_feature_scores=feature_scores.to_dict(),
                final_score=final_score,
                final_rank=0,
                confidence_score=confidence_score,
                matching_reasons=matching_reasons,
                metadata=activity.metadata,
            )

            # Tuple: (final_score, -stage1_rank, has_conflict, match_obj)
            reranked_tuples.append((final_score, -candidate.rank, has_conflict, match_obj))

        # 3. Primary sort: final_score descending, secondary sort: Stage 1 rank (higher priority)
        reranked_tuples.sort(key=lambda x: (x[0], x[1]), reverse=True)

        # 4. Stage 1 Winner Preservation Guard:
        # If Stage 1 candidate #1 has no entity conflict AND final score difference with top reranked candidate is <= 0.015,
        # preserve Stage 1 #1 rank.
        stage1_top1_candidate = candidate_matches[0]
        s1_db_id = stage1_top1_candidate.activity_id

        top_reranked_obj = reranked_tuples[0][3]
        if top_reranked_obj.activity_db_id != s1_db_id:
            # Find Stage 1 top 1 candidate in reranked_tuples
            s1_tuple_idx = None
            for idx, item in enumerate(reranked_tuples):
                if item[3].activity_db_id == s1_db_id:
                    s1_tuple_idx = idx
                    break

            if s1_tuple_idx is not None:
                s1_score = reranked_tuples[s1_tuple_idx][0]
                s1_has_conflict = reranked_tuples[s1_tuple_idx][2]
                top_score = reranked_tuples[0][0]

                if not s1_has_conflict and (top_score - s1_score) <= 0.035:
                    # Move Stage 1 winner back to #1
                    s1_item = reranked_tuples.pop(s1_tuple_idx)
                    reranked_tuples.insert(0, s1_item)


        final_matches: List[RerankedCandidateMatch] = []
        for idx, item in enumerate(reranked_tuples[:top_k], start=1):
            match_obj = item[3]
            match_obj.final_rank = idx
            final_matches.append(match_obj)

        return RerankResult(
            evidence_id=evidence.id,
            raw_text=evidence.raw_text,
            matches=final_matches,
        )
