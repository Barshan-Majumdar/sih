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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-primary" />
              Human-in-the-Loop Review Queue
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Verify AI-matched field observations before progress updates the master engineering schedule.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/projects/${projectId}/plan-vs-actual`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
            >
              <TrendingUp className="w-4 h-4 text-primary" />
              Plan vs Actual
            </Link>
            <Link
              href={`/projects/${projectId}/field-intake`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <Layers className="w-4 h-4" />
              Submit New DPR
            </Link>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3-Tier Routing Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "pending"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Pending Review (70% - 89%)
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
            {pendingReview.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("auto")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "auto"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Auto-Linked (&ge; 90%)
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
            {autoLinked.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("unmatched")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "unmatched"
              ? "border-slate-500 text-slate-600 dark:text-slate-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Unmatched (&lt; 70%)
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-500/10 text-slate-600 dark:text-slate-400 font-semibold">
            {unmatched.length}
          </span>
        </button>
      </div>

      {/* Queue Items */}
      {currentList.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border bg-card/50">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">All Clean!</h3>
          <p className="text-xs text-muted-foreground mt-1">
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
                className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4 transition-all hover:border-primary/40"
              >
                {/* Top Bar: Observation Meta */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-primary/10 text-primary uppercase tracking-wide">
                      {obs.eventType}
                    </span>
                    {obs.progressPercent !== null && obs.progressPercent !== undefined && (
                      <span className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {Math.round(obs.progressPercent)}% Progress
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(obs.extractedDate)}
                    </span>
                  </div>

                  {topCandidate && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Confidence:</span>
                      <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-full">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span
                          className={`text-xs font-bold ${
                            confidencePct >= 90
                              ? "text-emerald-600 dark:text-emerald-400"
                              : confidencePct >= 70
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-500"
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
                  <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-lg border border-border/50">
                    <span className="text-xs font-semibold text-muted-foreground">
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
                            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                : "bg-card border border-border text-foreground hover:bg-accent"
                            }`}
                          >
                            #{idx + 1}: {cm.task?.name ? cm.task.name.slice(0, 24) : "Task"} (
                            {Math.round(cm.confidenceScore * 100)}%)
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Content Split: Field Evidence vs Matched Schedule Task */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Field Evidence */}
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/60 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Field DPR Note
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      &ldquo;{obs.rawText}&rdquo;
                    </p>
                  </div>

                  {/* Right: Matched Schedule Activity */}
                  <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-2">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5" />
                      Matched Schedule Activity
                    </p>
                    {topCandidate && topCandidate.task ? (
                      <div>
                        <p className="text-base font-bold text-foreground">
                          {topCandidate.task.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>
                            Dates: {formatDate(topCandidate.task.startDate)} -{" "}
                            {formatDate(topCandidate.task.endDate)}
                          </span>
                          <span>Current: {topCandidate.task.progress}%</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No candidate activity exceeded confidence threshold.
                      </p>
                    )}
                  </div>
                </div>

                {/* Explainability Signals Breakdown */}
                {topCandidate && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Explainable AI Matching Signals:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {reasons.length > 0 ? (
                        reasons.map((reason: string, rIdx: number) => (
                          <span
                            key={rIdx}
                            className="text-xs px-2.5 py-1 rounded bg-secondary text-secondary-foreground font-medium"
                          >
                            ✓ {reason}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          Hybrid Vector + BM25 RRF Rank Score
                        </span>
                      )}

                      {isConflict && (
                        <span className="text-xs px-2.5 py-1 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-semibold border border-red-500/30">
                          ⚠️ Asset Conflict Detected (-40% Penalty Applied)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Reviewer Action Buttons */}
                {topCandidate ? (
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    {obs.matchStatus === "AUTO_LINKED" ? (
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified & linked directly to master schedule
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
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
                        className="px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded hover:bg-destructive/10 disabled:opacity-50 flex items-center gap-1 transition-colors"
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
                          className="px-4 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm"
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                    <span>
                      Observation recorded. You can link this activity once scheduled in the CPM plan.
                    </span>
                    <Link
                      href={`/projects/${projectId}/gantt`}
                      className="text-primary font-medium hover:underline inline-flex items-center gap-1"
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
