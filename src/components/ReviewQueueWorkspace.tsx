"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitReviewDecision } from "@/app/actions/field-progress";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

interface CandidateMatchData {
  id: string;
  confidenceScore: number;
  componentScores: any;
  task: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    progress: number;
    status: string;
  };
}

interface ObservationData {
  id: string;
  rawText: string;
  eventType: string;
  extractedDate: Date;
  progressPercent: number | null;
  matchStatus: string;
  task?: {
    id: string;
    name: string;
  } | null;
  candidateMatches: CandidateMatchData[];
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
  const [activeTab, setActiveTab] = useState<"pending" | "auto" | "unmatched">("pending");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "Failed to submit decision");
    } finally {
      setSubmittingId(null);
    }
  };

  const getActiveList = () => {
    switch (activeTab) {
      case "pending":
        return pendingReview;
      case "auto":
        return autoLinked;
      case "unmatched":
        return unmatched;
    }
  };

  const currentList = getActiveList();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Human-in-the-Loop Review Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify AI-matched field observations before progress updates the master engineering schedule.
          </p>
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
            const topCandidate = obs.candidateMatches[0];
            const confidencePct = topCandidate ? Math.round(topCandidate.confidenceScore * 100) : 0;
            const reasons = topCandidate?.componentScores?.matching_reasons || [];
            const isConflict = topCandidate?.componentScores?.conflict_penalty < 0;

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
                    {obs.progressPercent !== null && (
                      <span className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {Math.round(obs.progressPercent)}% Progress
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(obs.extractedDate).toLocaleDateString()}
                    </span>
                  </div>

                  {topCandidate && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Confidence:</span>
                      <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-full">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span className={`text-xs font-bold ${
                          confidencePct >= 90
                            ? "text-emerald-600 dark:text-emerald-400"
                            : confidencePct >= 70
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-500"
                        }`}>
                          {confidencePct}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content Split: Field Evidence vs Matched Schedule Task */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Field Evidence */}
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/60 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Field DPR Note
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      "{obs.rawText}"
                    </p>
                  </div>

                  {/* Right: Matched Schedule Activity */}
                  <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-2">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5" />
                      Matched Schedule Activity
                    </p>
                    {topCandidate ? (
                      <div>
                        <p className="text-base font-bold text-foreground">
                          {topCandidate.task.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Dates: {new Date(topCandidate.task.startDate).toLocaleDateString()} - {new Date(topCandidate.task.endDate).toLocaleDateString()}</span>
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
                    <p className="text-xs font-semibold text-muted-foreground">Explainable AI Matching Signals:</p>
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
                {topCandidate && obs.matchStatus !== "AUTO_LINKED" && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                    <button
                      type="button"
                      disabled={submittingId === topCandidate.id}
                      onClick={() => handleDecision(topCandidate.id, "REJECTED", topCandidate.task.name)}
                      className="px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded hover:bg-destructive/10 disabled:opacity-50 flex items-center gap-1 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject Match
                    </button>
                    <button
                      type="button"
                      disabled={submittingId === topCandidate.id}
                      onClick={() => handleDecision(topCandidate.id, "APPROVED", topCandidate.task.name)}
                      className="px-4 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve & Update Schedule
                    </button>
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
