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

const STATUS_BADGES: Record<SubmittalStatus, string> = {
  PENDING: "bg-surface-soft border-hairline text-ink",
  APPROVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  REJECTED: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  REVISE_RESUBMIT: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
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
        <div className="rounded-2xl border border-dashed border-hairline bg-surface-soft/40 px-6 py-12 text-center">
          <p className="text-sm font-semibold tracking-tight text-ink">No submittals match this filter</p>
          <p className="mt-1 text-xs text-muted">Shop drawings, product data, and physical samples will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3.5">
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
    <form onSubmit={handleSubmit} className="rounded-2xl border border-hairline bg-surface-soft/80 p-5 shadow-card">
      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Material & Spec approval</p>
        <h3 className="text-sm font-semibold tracking-tight text-ink mt-0.5">New Submittal</h3>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Submittal title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Structural Steel Shop Drawings)"
          className="h-9 flex-1 min-w-[220px] rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
        />
        <input
          aria-label="Specification section"
          value={specSection}
          onChange={(e) => setSpecSection(e.target.value)}
          placeholder="Spec section"
          className="h-9 w-32 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
        />
        <select
          aria-label="Linked task"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="h-9 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all shadow-2xs"
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
          className="h-9 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
        />
        <Button type="submit" variant="primary" disabled={loading || !title.trim()} className="h-9 text-xs font-semibold shadow-2xs">
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
    <li className="rounded-2xl border border-hairline bg-canvas p-5 shadow-card hover:shadow-card-hover transition-all">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold tracking-tight text-ink">{submittal.title}</span>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-tight ${STATUS_BADGES[submittal.status]}`}>
          {SUBMITTAL_STATUS_LABELS[submittal.status]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted mb-2 font-mono">
        {submittal.source === "PROCORE" && (
          <span className="font-sans px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px] font-bold">
            From Procore
          </span>
        )}
        {submittal.specSection && <span className="font-sans font-medium text-ink/80">Spec: {submittal.specSection}</span>}
        {submittal.task && <span className="font-sans font-medium text-ink">Task: {submittal.task.name}</span>}
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
            className="btn-interactive inline-flex items-center gap-1 font-sans font-medium text-ink hover:underline"
          >
            Doc: {submittal.attachment.fileName}
            {submittal.pageNumber ? ` · p.${submittal.pageNumber}` : ""}
            <ExternalLink size={10} aria-hidden />
          </button>
        )}
        {submittal.dueDate && (
          <span className={isOverdue ? "text-rose-600 dark:text-rose-400 font-bold" : undefined}>
            Due {formatDate(submittal.dueDate)}
            {isOverdue ? " (overdue)" : ""}
          </span>
        )}
        <span>Submitted by {submittal.submittedBy.user.name}</span>
      </div>
      {submittal.citationExcerpt && (
        <blockquote className="mb-2 border-l-2 border-hairline pl-3 text-xs leading-5 text-muted italic">
          &ldquo;{submittal.citationExcerpt}&rdquo;
        </blockquote>
      )}
      {canDecide && submittal.status !== "APPROVED" && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-hairline">
          {STATUS_OPTIONS.filter((s) => s !== submittal.status).map((s) => (
            <Button
              key={s}
              variant="secondary"
              className="h-7 px-2.5 text-xs font-semibold shadow-2xs"
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
