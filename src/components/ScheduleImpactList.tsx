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
        <p className="app-empty-title py-6 text-center">No schedule impact requests match this filter</p>
      ) : (
        <ul className="space-y-4">
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
    <form onSubmit={handleSubmit} className="border border-hairline rounded-lg p-4 bg-surface-soft">
      <h3 className="app-card-title mb-3">Submit a Schedule Impact Request</h3>
      <textarea
        aria-label="Schedule impact description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What field condition is affecting the schedule?"
        rows={2}
        maxLength={1000}
        className="w-full text-sm rounded-md border border-hairline px-3 py-2 focus:outline-none focus:border-ink resize-none mb-3"
      />
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Affected task"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
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
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <Button type="submit" variant="secondary" disabled={loading || !description.trim()}>
          {loading ? "Submitting…" : "Submit"}
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

  const statusColor =
    sir.status === "APPROVED" ? "text-success" : sir.status === "REJECTED" ? "text-error" : "text-muted";

  return (
    <li className="border border-hairline rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="app-card-title">{sir.submittedBy.user.name}</span>
        <span className={`text-xs font-medium ${statusColor}`}>{SIR_STATUS_LABELS[sir.status]}</span>
      </div>
      <p className="text-sm text-body mb-2">{sir.description}</p>
      <div className="flex flex-wrap gap-3 text-xs text-muted mb-2">
        {sir.task && <span>Task: {sir.task.name}</span>}
        {sir.proposedNewEndDate && <span>Proposed new end: {formatDate(sir.proposedNewEndDate)}</span>}
        <span>{formatDate(sir.createdAt)}</span>
      </div>
      {sir.reviewNote && (
        <p className="text-xs text-muted-soft mb-2">
          Review note ({sir.reviewedBy?.user.name}): {sir.reviewNote}
        </p>
      )}
      {sir.status === "PENDING" && canReview && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <input
            aria-label="Review note"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Review note (optional)"
            className="h-8 flex-1 min-w-[160px] rounded-md border border-hairline bg-canvas px-2 text-xs focus:outline-none focus:border-ink"
          />
          <Button variant="secondary" className="h-8 px-2 text-xs" onClick={() => handleReview("APPROVED")} disabled={pending}>
            Approve
          </Button>
          <Button variant="text" className="h-8 px-2 text-xs text-error" onClick={() => handleReview("REJECTED")} disabled={pending}>
            Reject
          </Button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </li>
  );
}
