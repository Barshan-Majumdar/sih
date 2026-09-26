"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitReviewDecision } from "@/app/actions/field-progress";
import { formatDate } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  RotateCcw,
  TrendingUp,
  Loader2,
} from "lucide-react";

export interface CandidateMatchData {
  id: string;
  confidenceScore: number;
  componentScores: Record<string, unknown> | null;
  task: {
    id: string;
    name: string;
    startDate: Date | string;
    endDate: Date | string;
    progress: number;
    status: string;
  };
}

export interface ObservationData {
  id: string;
  rawText: string;
  eventType: string;
  extractedDate: Date | string;
  progressPercent: number | null;
  matchStatus: string;
  task?: {
    id: string;
    name: string;
  } | null;
  candidateMatches?: CandidateMatchData[];
}

interface ReviewQueueWorkspaceProps {
  projectId: string;
  autoLinked: ObservationData[];
  pendingReview: ObservationData[];
  unmatched: ObservationData[];
}

export function ReviewQueueWorkspace({
  projectId,
  autoLinked,
  pendingReview,
  unmatched,
}: ReviewQueueWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"pending" | "auto" | "unmatched">("pending");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<Record<string, string>>({});

  const handleDecision = async (
    candidateMatchId: string,
    decision: "APPROVED" | "REJECTED",
    taskName: string
  ) => {
    setSubmittingId(candidateMatchId);
    try {
      await submitReviewDecision({
        candidateMatchId,
        decision,
      });

      setToastMessage(
        decision === "APPROVED"
          ? `Successfully approved and linked progress to "${taskName}"!`
          : `Match rejected.`
      );
      setTimeout(() => setToastMessage(null), 4000);

      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit decision";
      alert(message);
    } finally {
      setSubmittingId(null);
    }
  };

  const currentList = useMemo(() => {
    switch (activeTab) {
      case "pending":
        return pendingReview ?? [];
      case "auto":
        return autoLinked ?? [];
      case "unmatched":
        return unmatched ?? [];
      default:
        return [];
    }
  }, [activeTab, pendingReview, autoLinked, unmatched]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-hairline pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Human-in-the-Loop Review Queue
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-1">
              Verify AI-matched field observations before progress updates the master engineering schedule.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/plan-vs-actual/${projectId}`}
              className="btn-interactive inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas transition-colors shadow-2xs"
            >
              <TrendingUp className="w-3.5 h-3.5 text-ink" />
              Plan vs Actual
            </Link>
            <Link
              href={`/field-intake/${projectId}`}
              className="btn-interactive inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-xs font-semibold text-canvas shadow-xs hover:bg-ink/90 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              Submit New DPR
            </Link>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs sm:text-sm flex items-center gap-2 animate-in fade-in duration-200 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3-Tier Routing Tabs as Segmented Control */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-hairline/80 bg-surface-soft/80 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`btn-interactive flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold tracking-tight transition-all ${
            activeTab === "pending"
              ? "border border-ink bg-ink text-canvas shadow-[0_2px_6px_rgba(15,23,42,0.14)]"
              : "border border-transparent text-muted hover:border-hairline hover:bg-surface-soft hover:text-ink"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          Pending Review (70% - 89%)
          <span
            className={`ml-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold font-mono ${
              activeTab === "pending"
                ? "bg-canvas/20 text-canvas"
                : "bg-surface-soft border border-hairline text-ink"
            }`}
          >
            {pendingReview.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("auto")}
          className={`btn-interactive flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold tracking-tight transition-all ${
            activeTab === "auto"
              ? "border border-ink bg-ink text-canvas shadow-[0_2px_6px_rgba(15,23,42,0.14)]"
              : "border border-transparent text-muted hover:border-hairline hover:bg-surface-soft hover:text-ink"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Auto-Linked (&ge; 90%)
          <span
            className={`ml-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold font-mono ${
              activeTab === "auto"
                ? "bg-canvas/20 text-canvas"
                : "bg-surface-soft border border-hairline text-ink"
            }`}
          >
            {autoLinked.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("unmatched")}
          className={`btn-interactive flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold tracking-tight transition-all ${
            activeTab === "unmatched"
              ? "border border-ink bg-ink text-canvas shadow-[0_2px_6px_rgba(15,23,42,0.14)]"
              : "border border-transparent text-muted hover:border-hairline hover:bg-surface-soft hover:text-ink"
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5 text-muted" />
          Unmatched (&lt; 70%)
          <span
            className={`ml-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold font-mono ${
              activeTab === "unmatched"
                ? "bg-canvas/20 text-canvas"
                : "bg-surface-soft border border-hairline text-ink"
            }`}
          >
            {unmatched.length}
          </span>
        </button>
      </div>

      {/* Queue Items */}
      {currentList.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-hairline bg-surface-soft/40">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto mb-3" />
          <h3 className="text-sm font-semibold tracking-tight text-ink">All Clean!</h3>
          <p className="text-xs text-muted mt-1">
            There are no observations waiting in this queue tier.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentList.map((obs) => {
            const candidateMatches = obs.candidateMatches ?? [];
            const selectedId = selectedCandidateId[obs.id];
            const topCandidate =
              (selectedId ? candidateMatches.find((cm) => cm.id === selectedId) : null) ??
              candidateMatches[0];
            const confidencePct = topCandidate ? Math.round(topCandidate.confidenceScore * 100) : 0;
            const rawReasons = topCandidate?.componentScores?.matching_reasons;
            const reasons = Array.isArray(rawReasons) ? (rawReasons as string[]) : [];
            const conflictVal = topCandidate?.componentScores?.conflict_penalty;
            const isConflict = typeof conflictVal === "number" && conflictVal < 0;
            const isSubmitting = submittingId === topCandidate?.id;

            return (
              <div
                key={obs.id}
                className="rounded-2xl border border-hairline bg-canvas p-5 shadow-card hover:shadow-card-hover space-y-4 transition-all"
              >
                {/* Top Bar: Observation Meta */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-tight bg-surface-soft border border-hairline text-ink uppercase">
                      {obs.eventType}
                    </span>
                    {obs.progressPercent !== null && obs.progressPercent !== undefined && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300">
                        {Math.round(obs.progressPercent)}% Progress
                      </span>
                    )}
                    <span className="text-xs text-muted flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-muted" />
                      {formatDate(obs.extractedDate)}
                    </span>
                  </div>

                  {topCandidate && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted">Confidence:</span>
                      <div className="flex items-center gap-1.5 bg-surface-soft border border-hairline px-2.5 py-1 rounded-full shadow-2xs">
                        <Sparkles className="w-3 h-3 text-ink" />
                        <span
                          className={`text-xs font-bold font-mono ${
                            confidencePct >= 90
                              ? "text-emerald-600 dark:text-emerald-400"
                              : confidencePct >= 70
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {confidencePct}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Candidate Selector if Multiple Matches Exist */}
                {candidateMatches.length > 1 && (
                  <div className="flex items-center gap-2 bg-surface-soft/80 p-2.5 rounded-xl border border-hairline">
                    <span className="text-xs font-semibold tracking-tight text-ink">
                      Multiple Ranked Candidates ({candidateMatches.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {candidateMatches.map((cm, idx) => {
                        const isSelected = topCandidate?.id === cm.id;
                        return (
                          <button
                            key={cm.id}
                            type="button"
                            onClick={() =>
                              setSelectedCandidateId((prev) => ({ ...prev, [obs.id]: cm.id }))
                            }
                            className={`btn-interactive text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                              isSelected
                                ? "bg-ink text-canvas font-semibold shadow-2xs"
                                : "bg-canvas border border-hairline text-ink hover:bg-surface-soft"
                            }`}
                          >
                            #{idx + 1}: {cm.task?.name ? cm.task.name.slice(0, 24) : "Task"} (
                            <span className="font-mono">{Math.round(cm.confidenceScore * 100)}%</span>)
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Content Split: Field Evidence vs Matched Schedule Task */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Field Evidence */}
                  <div className="bg-surface-soft/60 p-4 rounded-xl border border-hairline space-y-2">
                    <p className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Field DPR Note
                    </p>
                    <p className="text-sm text-ink leading-relaxed">
                      &ldquo;{obs.rawText}&rdquo;
                    </p>
                  </div>

                  {/* Right: Matched Schedule Activity */}
                  <div className="bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] p-4 rounded-xl border border-emerald-500/20 space-y-2">
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5" />
                      Matched Schedule Activity
                    </p>
                    {topCandidate && topCandidate.task ? (
                      <div>
                        <p className="text-sm sm:text-base font-bold tracking-tight text-ink">
                          {topCandidate.task.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted font-mono">
                          <span>
                            Dates: {formatDate(topCandidate.task.startDate)} -{" "}
                            {formatDate(topCandidate.task.endDate)}
                          </span>
                          <span className="font-semibold text-ink">
                            Progress: {topCandidate.task.progress}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted italic">
                        No candidate activity exceeded confidence threshold.
                      </p>
                    )}
                  </div>
                </div>

                {/* Explainability Signals Breakdown */}
                {topCandidate && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-semibold tracking-tight text-muted">
                      Explainable AI Matching Signals:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {reasons.length > 0 ? (
                        reasons.map((reason: string, rIdx: number) => (
                          <span
                            key={rIdx}
                            className="text-xs px-2.5 py-1 rounded-lg bg-surface-soft border border-hairline text-ink font-medium shadow-2xs"
                          >
                            ✓ {reason}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-surface-soft border border-hairline text-muted">
                          Hybrid Vector + BM25 RRF Rank Score
                        </span>
                      )}

                      {isConflict && (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold border border-rose-500/25">
                          ⚠️ Asset Conflict Detected (-40% Penalty Applied)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Reviewer Action Buttons */}
                {topCandidate ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-hairline">
                    {obs.matchStatus === "AUTO_LINKED" ? (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Verified & linked directly to master schedule
                      </span>
                    ) : (
                      <span className="text-xs text-muted">
                        Requires supervisor signoff before updating CPM schedule
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSubmitting || isPending}
                        onClick={() =>
                          handleDecision(
                            topCandidate.id,
                            "REJECTED",
                            topCandidate.task?.name ?? "Activity"
                          )
                        }
                        className="btn-interactive px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {obs.matchStatus === "AUTO_LINKED" ? "Override & Revoke" : "Reject Match"}
                      </button>

                      {obs.matchStatus !== "AUTO_LINKED" && (
                        <button
                          type="button"
                          disabled={isSubmitting || isPending}
                          onClick={() =>
                            handleDecision(
                              topCandidate.id,
                              "APPROVED",
                              topCandidate.task?.name ?? "Activity"
                            )
                          }
                          className="btn-interactive px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          Approve & Update Schedule
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-hairline text-xs text-muted">
                    <span>
                      Observation recorded. You can link this activity once scheduled in the CPM plan.
                    </span>
                    <Link
                      href={`/gantt/${projectId}`}
                      className="text-ink font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      View Schedule Gantt &rarr;
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
