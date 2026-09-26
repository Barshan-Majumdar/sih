"use client";

import { useState, useTransition } from "react";
import { createScheduleImpactRequest, reviewScheduleImpactRequest } from "@/app/actions/schedule-impacts";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { SIR_STATUS_LABELS, formatDate } from "@/lib/utils";
import type { SirStatus } from "@prisma/client";

export type SirRow = {
  id: string;
  description: string;
  proposedNewEndDate: Date | null;
  status: SirStatus;
  reviewNote: string | null;
  createdAt: Date;
  submittedBy: { user: { name: string } };
  reviewedBy: { user: { name: string } } | null;
  task: { id: string; name: string } | null;
};

export type TaskOption = { id: string; name: string };

export function ScheduleImpactList({
  projectId,
  sirs,
  tasks,
  canReview,
}: {
  projectId: string;
  sirs: SirRow[];
  tasks: TaskOption[];
  canReview: boolean;
}) {
  return (
    <div className="space-y-6">
      <SubmitSirForm projectId={projectId} tasks={tasks} />

      {sirs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-surface-soft/40 px-6 py-12 text-center">
          <p className="text-sm font-semibold tracking-tight text-ink">No schedule impact requests match this filter</p>
          <p className="mt-1 text-xs text-muted">Field condition impact requests will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3.5">
          {sirs.map((sir) => (
            <SirCard key={sir.id} sir={sir} canReview={canReview} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubmitSirForm({ projectId, tasks }: { projectId: string; tasks: TaskOption[] }) {
  const [description, setDescription] = useState("");
  const [taskId, setTaskId] = useState("");
  const [proposedNewEndDate, setProposedNewEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createScheduleImpactRequest({
      projectId,
      taskId: taskId || null,
      description,
      proposedNewEndDate: proposedNewEndDate || null,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setDescription("");
    setTaskId("");
    setProposedNewEndDate("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-hairline bg-surface-soft/80 p-5 shadow-card">
      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Change management</p>
        <h3 className="text-sm font-semibold tracking-tight text-ink mt-0.5">Submit a Schedule Impact Request</h3>
      </div>
      <textarea
        aria-label="Schedule impact description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What field condition is affecting the schedule?"
        rows={2}
        maxLength={1000}
        className="w-full text-xs sm:text-sm rounded-xl border border-hairline bg-canvas p-3 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink resize-none mb-3 transition-all"
      />
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Affected task"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="h-9 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
        >
          <option value="">No specific task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Proposed new end date"
          type="date"
          value={proposedNewEndDate}
          onChange={(e) => setProposedNewEndDate(e.target.value)}
          title="Proposed new end date (optional)"
          className="h-9 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
        />
        <Button type="submit" variant="primary" disabled={loading || !description.trim()} className="h-9 text-xs font-semibold shadow-2xs">
          {loading ? "Submitting…" : "Submit Request"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

function SirCard({ sir, canReview }: { sir: SirRow; canReview: boolean }) {
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReview(status: "APPROVED" | "REJECTED") {
    setError(null);
    startTransition(async () => {
      const result = await reviewScheduleImpactRequest({ sirId: sir.id, status, reviewNote });
      if (!result.success) setError(result.error);
    });
  }

  const statusBadge =
    sir.status === "APPROVED"
      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
      : sir.status === "REJECTED"
      ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
      : "bg-surface-soft border-hairline text-muted";

  return (
    <li className="rounded-2xl border border-hairline bg-canvas p-5 shadow-card hover:shadow-card-hover transition-all">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold tracking-tight text-ink">{sir.submittedBy.user.name}</span>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-tight ${statusBadge}`}>
          {SIR_STATUS_LABELS[sir.status]}
        </span>
      </div>
      <p className="text-sm text-ink leading-relaxed mb-3">{sir.description}</p>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted mb-3 font-mono">
        {sir.task && <span className="font-sans font-medium text-ink/80">Task: {sir.task.name}</span>}
        {sir.proposedNewEndDate && <span>Proposed new end: {formatDate(sir.proposedNewEndDate)}</span>}
        <span className="text-muted/60">Submitted: {formatDate(sir.createdAt)}</span>
      </div>
      {sir.reviewNote && (
        <div className="rounded-xl border border-hairline bg-surface-soft/60 p-3 text-xs text-muted mb-3">
          <span className="font-semibold text-ink">Review note ({sir.reviewedBy?.user.name}):</span> {sir.reviewNote}
        </div>
      )}
      {sir.status === "PENDING" && canReview && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-hairline">
          <input
            aria-label="Review note"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Review note (optional)"
            className="h-8 flex-1 min-w-[160px] rounded-lg border border-hairline bg-surface-soft px-2.5 text-xs text-ink focus:bg-canvas focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
          />
          <Button variant="secondary" className="h-8 px-3 text-xs font-semibold shadow-2xs" onClick={() => handleReview("APPROVED")} disabled={pending}>
            Approve
          </Button>
          <Button variant="danger" className="h-8 px-3 text-xs font-semibold" onClick={() => handleReview("REJECTED")} disabled={pending}>
            Reject
          </Button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </li>
  );
}
