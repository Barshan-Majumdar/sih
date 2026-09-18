/**
 * Client for communicating with the Python Hybrid Candidate Retrieval & Contextual Reranking Microservice.
 * Runs on http://localhost:8000 (configurable via RETRIEVAL_SERVICE_URL).
 */

const RETRIEVAL_SERVICE_URL =
  process.env.RETRIEVAL_SERVICE_URL || "http://localhost:8000";

export interface ScheduleActivityIndexItem {
  id: string;
  activity_id: string;
  name: string;
  level: number;
  parent_id?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  metadata?: Record<string, unknown>;
  predecessors?: string[];
  successors?: string[];
  status?: string;
}

export interface MatchEvidencePayload {
  id?: string;
  raw_text: string;
  extracted_date?: string | null;
  event_type?: string | null;
}

export interface MatchContextPayload {
  discipline?: string | null;
  location?: string | null;
  asset?: string | null;
  wbs_path?: string | null;
  activity_type?: string | null;
  identifiers?: string[];
  extracted_date?: string | null;
}

export interface CandidateMatchResult {
  schedule_activity_id: string;
  activity_id: string;
  name: string;
  confidence_score: number;
  component_scores: Record<string, unknown>;
  matching_reasons: string[];
  rank: number;
}

export interface ExtractedObservationItem {
  raw_text: string;
  event_type: "STARTED" | "COMPLETED" | "PAUSED" | "REWORK" | "PROGRESS";
  extracted_date: string;
  progress_percent?: number | null;
  source_snippet?: string | null;
}

/**
 * Check if the Python retrieval microservice is running.
 */
export async function getRetrievalHealth(): Promise<{
  status: string;
  indexed_activities_count: number;
  normalization_enabled: boolean;
}> {
  const res = await fetch(`${RETRIEVAL_SERVICE_URL}/health`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Retrieval service health check failed with status: ${res.status}`);
  }
  return res.json();
}

/**
 * Index a list of project schedule activities into BM25 and FAISS neural index.
 */
export async function indexScheduleActivities(
  activities: ScheduleActivityIndexItem[]
): Promise<{ status: string; indexed_count: number; elapsed_ms: number }> {
  const res = await fetch(`${RETRIEVAL_SERVICE_URL}/api/retrieval/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activities }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to index activities (${res.status}): ${errorText}`);
  }
  return res.json();
}

/**
 * Normalize site jargon using construction glossary (100+ terms).
 */
export async function normalizeSiteText(
  text: string,
  appendOriginal = true
): Promise<{
  raw_text: string;
  normalized_text: string;
  discipline_tags: string[];
}> {
  const res = await fetch(`${RETRIEVAL_SERVICE_URL}/api/retrieval/normalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, append_original: appendOriginal }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Text normalization failed (${res.status}): ${errorText}`);
  }
  return res.json();
}

/**
 * Run Stage 1 (Hybrid BM25 + FAISS) and Stage 2 (8-Signal Contextual Reranker)
 * to find top matching schedule tasks for a piece of field evidence.
 */
export async function matchFieldEvidence(
  evidence: MatchEvidencePayload,
  explicitContext?: MatchContextPayload,
  topK = 5
): Promise<{
  matches: CandidateMatchResult[];
  adaptive_weights?: { retrieval_weight: number; context_weight: number };
}> {
  const res = await fetch(`${RETRIEVAL_SERVICE_URL}/api/retrieval/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      evidence,
      explicit_context: explicitContext,
      top_k: topK,
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Candidate matching failed (${res.status}): ${errorText}`);
  }
  const data = await res.json();
  interface RawCandidateMatch {
    schedule_activity_id?: string;
    activity_db_id?: string;
    activity_id?: string;
    activity_code?: string;
    name?: string;
    activity_name?: string;
    confidence_score?: number;
    contextual_feature_scores?: Record<string, unknown>;
    component_scores?: Record<string, unknown>;
    matching_reasons?: string[];
    final_rank?: number;
    rank?: number;
  }
  const rawMatches: RawCandidateMatch[] = Array.isArray(data.matches) ? data.matches : [];
  const normalizedMatches: CandidateMatchResult[] = rawMatches.map((m: RawCandidateMatch, idx: number) => ({
    schedule_activity_id: m.schedule_activity_id || m.activity_db_id || m.activity_id || "",
    activity_id: m.activity_id || m.activity_code || m.activity_db_id || "",
    name: m.name || m.activity_name || "",
    confidence_score: typeof m.confidence_score === "number" ? m.confidence_score : 0,
    component_scores: m.contextual_feature_scores || m.component_scores || {},
    matching_reasons: Array.isArray(m.matching_reasons) ? m.matching_reasons : [],
    rank: m.final_rank || m.rank || idx + 1,
  }));
  return {
    ...data,
    matches: normalizedMatches,
  };
}

/**
 * Extract multiple discrete observations from a raw DPR paragraph using Gemini LLM.
 */
export async function extractObservationsFromDpr(
  dprText: string,
  reportDate?: string
): Promise<{ observations: ExtractedObservationItem[] }> {
  const res = await fetch(`${RETRIEVAL_SERVICE_URL}/api/extraction/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      report_text: dprText,
      report_date: reportDate || new Date().toISOString().split("T")[0],
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`DPR observation extraction failed (${res.status}): ${errorText}`);
  }
  const data = await res.json();
  return {
    observations: data.observations || data.items || [],
  };
}
