"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { createSubmittal, updateSubmittalStatus } from "@/app/actions/submittals";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { openPdfViewer } from "@/lib/pdf-viewer";
import { SUBMITTAL_STATUS_LABELS, formatDate } from "@/lib/utils";
import type { SubmittalStatus, IntegrationSource } from "@prisma/client";

export type SubmittalRow = {
  id: string;
  title: string;
  specSection: string | null;
  status: SubmittalStatus;
  source: IntegrationSource;
  dueDate: Date | null;
  createdAt: Date;
  submittedBy: { user: { name: string } };
  task: { id: string; name: string } | null;
  attachment: { fileName: string; fileUrl: string } | null;
  pageNumber: number | null;
  citationExcerpt: string | null;
};

export type TaskOption = { id: string; name: string };

const STATUS_OPTIONS: SubmittalStatus[] = ["PENDING", "APPROVED", "REJECTED", "REVISE_RESUBMIT"];

const STATUS_COLORS: Record<SubmittalStatus, string> = {
  PENDING: "text-muted",
  APPROVED: "text-success",
  REJECTED: "text-error",
  REVISE_RESUBMIT: "text-amber-600",
};

export function SubmittalList({
  projectId,
  submittals,
  tasks,
  canDecide,
}: {
  projectId: string;
  submittals: SubmittalRow[];
  tasks: TaskOption[];
  canDecide: boolean;
}) {
  return (
    <div className="space-y-6">
      <NewSubmittalForm projectId={projectId} tasks={tasks} />

      {submittals.length === 0 ? (
        <p className="app-empty-title py-6 text-center">No submittals match this filter</p>
      ) : (
        <ul className="space-y-3">
          {submittals.map((s) => (
            <SubmittalCard key={s.id} submittal={s} canDecide={canDecide} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NewSubmittalForm({ projectId, tasks }: { projectId: string; tasks: TaskOption[] }) {
  const [title, setTitle] = useState("");
  const [specSection, setSpecSection] = useState("");
  const [taskId, setTaskId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createSubmittal({
      projectId,
      title,
      specSection: specSection || null,
      taskId: taskId || null,
      dueDate: dueDate || null,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setTitle("");
    setSpecSection("");
    setTaskId("");
    setDueDate("");
  }

  return (
    <form onSubmit={handleSubmit} className="border border-hairline rounded-lg p-4 bg-surface-soft">
      <h3 className="app-card-title mb-3">New Submittal</h3>
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Submittal title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Structural Steel Shop Drawings)"
          className="h-10 flex-1 min-w-[220px] rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <input
          aria-label="Specification section"
          value={specSection}
          onChange={(e) => setSpecSection(e.target.value)}
          placeholder="Spec section"
          className="h-10 w-32 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <select
          aria-label="Linked task"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        >
          <option value="">No linked task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Submittal due date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <Button type="submit" variant="secondary" disabled={loading || !title.trim()}>
          {loading ? "Submitting…" : "Submit"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

function SubmittalCard({ submittal, canDecide }: { submittal: SubmittalRow; canDecide: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isOverdue = submittal.status === "PENDING" && submittal.dueDate && new Date(submittal.dueDate) < new Date();

  function handleStatusChange(status: SubmittalStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateSubmittalStatus({ submittalId: submittal.id, status });
      if (!result.success) setError(result.error);
    });
  }

  return (
    <li className="border border-hairline rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="app-card-title">{submittal.title}</span>
        <span className={`text-xs font-medium ${STATUS_COLORS[submittal.status]}`}>
          {SUBMITTAL_STATUS_LABELS[submittal.status]}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted mb-2">
        {submittal.source === "PROCORE" && <span className="text-muted-soft">From Procore</span>}
        {submittal.specSection && <span>Spec {submittal.specSection}</span>}
        {submittal.task && <span>Task: {submittal.task.name}</span>}
        {submittal.attachment && (
          <button
            type="button"
            onClick={() => openPdfViewer(
              submittal.attachment!.fileUrl,
              submittal.attachment!.fileName,
              "dashboard",
              {
                page: submittal.pageNumber ?? 1,
                highlight: submittal.citationExcerpt,
              }
            )}
            className="inline-flex items-center gap-1 font-medium text-body hover:text-ink"
          >
            Source: {submittal.attachment.fileName}
            {submittal.pageNumber ? `, page ${submittal.pageNumber}` : ""}
            <ExternalLink size={11} aria-hidden />
          </button>
        )}
        {submittal.dueDate && (
          <span className={isOverdue ? "text-error font-medium" : undefined}>
            Due {formatDate(submittal.dueDate)}
            {isOverdue ? " — overdue" : ""}
          </span>
        )}
        <span>Submitted by {submittal.submittedBy.user.name}</span>
      </div>
      {submittal.citationExcerpt && (
        <p className="mb-2 border-l-2 border-hairline pl-3 text-xs leading-5 text-muted">
          {submittal.citationExcerpt}
        </p>
      )}
      {canDecide && submittal.status !== "APPROVED" && (
        <div className="flex flex-wrap gap-2 mt-2">
          {STATUS_OPTIONS.filter((s) => s !== submittal.status).map((s) => (
            <Button
              key={s}
              variant="text"
              className="h-7 px-2 text-xs"
              onClick={() => handleStatusChange(s)}
              disabled={pending}
            >
              Mark {SUBMITTAL_STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </li>
  );
}
