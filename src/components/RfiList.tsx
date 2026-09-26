"use client";

import { useState, useTransition } from "react";
import { createRfi, answerRfi, closeRfi } from "@/app/actions/rfis";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { openPdfViewer } from "@/lib/pdf-viewer";
import { RFI_STATUS_LABELS, formatDate } from "@/lib/utils";
import type { RfiStatus, IntegrationSource } from "@prisma/client";

export type RfiRow = {
  id: string;
  question: string;
  answer: string | null;
  status: RfiStatus;
  source: IntegrationSource;
  dueDate: Date | null;
  createdAt: Date;
  pageNumber: number | null;
  citationExcerpt: string | null;
  raisedBy: { user: { name: string } };
  task: { id: string; name: string } | null;
  attachment: { id: string; fileName: string; url: string } | null;
};

export type TaskOption = { id: string; name: string };
export type FileOption = { id: string; fileName: string };

const STATUS_BADGES: Record<RfiStatus, string> = {
  OPEN: "bg-surface-soft border-hairline text-ink",
  ANSWERED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  CLOSED: "bg-surface-soft/60 border-hairline/60 text-muted",
};

export function RfiList({
  projectId,
  rfis,
  tasks,
  files,
  canAnswer,
}: {
  projectId: string;
  rfis: RfiRow[];
  tasks: TaskOption[];
  files: FileOption[];
  canAnswer: boolean;
}) {
  return (
    <div className="space-y-6">
      <NewRfiForm projectId={projectId} tasks={tasks} files={files} />

      {rfis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-surface-soft/40 px-6 py-12 text-center">
          <p className="text-sm font-semibold tracking-tight text-ink">No RFIs match this filter</p>
          <p className="mt-1 text-xs text-muted">Field queries and clarifications will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3.5">
          {rfis.map((r) => (
            <RfiCard key={r.id} rfi={r} canAnswer={canAnswer} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NewRfiForm({
  projectId,
  tasks,
  files,
}: {
  projectId: string;
  tasks: TaskOption[];
  files: FileOption[];
}) {
  const [question, setQuestion] = useState("");
  const [taskId, setTaskId] = useState("");
  const [attachmentId, setAttachmentId] = useState("");
  const [pageNumber, setPageNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createRfi({
      projectId,
      question,
      taskId: taskId || null,
      attachmentId: attachmentId || null,
      pageNumber: pageNumber ? Number(pageNumber) : null,
      dueDate: dueDate || null,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setQuestion("");
    setTaskId("");
    setAttachmentId("");
    setPageNumber("");
    setDueDate("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-hairline bg-surface-soft/80 p-5 shadow-card">
      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Clarification</p>
        <h3 className="text-sm font-semibold tracking-tight text-ink mt-0.5">Raise an RFI</h3>
      </div>
      <textarea
        aria-label="RFI question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="What needs clarification?"
        rows={2}
        maxLength={1000}
        className="w-full text-xs sm:text-sm rounded-xl border border-hairline bg-canvas p-3 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink resize-none mb-3 transition-all"
      />
      <div className="flex flex-wrap items-center gap-3">
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
        <select
          aria-label="Source document"
          value={attachmentId}
          onChange={(e) => setAttachmentId(e.target.value)}
          className="h-9 max-w-[220px] rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all shadow-2xs"
        >
          <option value="">No source document</option>
          {files.map((file) => (
            <option key={file.id} value={file.id}>
              {file.fileName}
            </option>
          ))}
        </select>
        <input
          aria-label="Cited page"
          type="number"
          min={1}
          value={pageNumber}
          onChange={(e) => setPageNumber(e.target.value)}
          placeholder="Page"
          disabled={!attachmentId}
          title="Cited page (optional)"
          className="h-9 w-20 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink disabled:opacity-50 transition-all"
        />
        <input
          aria-label="Response needed by"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          title="Response needed by (optional)"
          className="h-9 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
        />
        <Button type="submit" variant="primary" disabled={loading || !question.trim()} className="h-9 text-xs font-semibold shadow-2xs">
          {loading ? "Submitting…" : "Submit RFI"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

function RfiCard({ rfi, canAnswer }: { rfi: RfiRow; canAnswer: boolean }) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isOverdue = rfi.status === "OPEN" && rfi.dueDate && new Date(rfi.dueDate) < new Date();
  const sourceHref = rfi.attachment
    ? `${rfi.attachment.url}${rfi.pageNumber ? `#page=${rfi.pageNumber}` : ""}`
    : null;

  function handleAnswer() {
    setError(null);
    startTransition(async () => {
      const result = await answerRfi({ rfiId: rfi.id, answer });
      if (!result.success) setError(result.error);
      else setAnswer("");
    });
  }

  function handleClose() {
    setError(null);
    startTransition(async () => {
      const result = await closeRfi({ rfiId: rfi.id });
      if (!result.success) setError(result.error);
    });
  }

  return (
    <li className="rounded-2xl border border-hairline bg-canvas p-5 shadow-card hover:shadow-card-hover transition-all">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold tracking-tight text-ink">{rfi.question}</span>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-tight ${STATUS_BADGES[rfi.status]}`}>
          {RFI_STATUS_LABELS[rfi.status]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted mb-2 font-mono">
        {rfi.source === "PROCORE" && (
          <span className="font-sans px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[10px] font-bold">
            From Procore
          </span>
        )}
        {rfi.task && <span className="font-sans font-medium text-ink">Task: {rfi.task.name}</span>}
        {rfi.attachment && sourceHref && (
          <button
            type="button"
            onClick={() => openPdfViewer(sourceHref, rfi.attachment!.fileName, "dashboard", {
              highlight: rfi.citationExcerpt,
            })}
            className="btn-interactive font-sans font-medium text-ink hover:underline"
          >
            Doc: {rfi.attachment.fileName}
            {rfi.pageNumber ? ` · p.${rfi.pageNumber}` : ""}
          </button>
        )}
        {rfi.dueDate && (
          <span className={isOverdue ? "text-rose-600 dark:text-rose-400 font-bold" : undefined}>
            Due {formatDate(rfi.dueDate)}
            {isOverdue ? " (overdue)" : ""}
          </span>
        )}
        <span>Raised by {rfi.raisedBy.user.name}</span>
      </div>
      {rfi.citationExcerpt && (
        <blockquote className="mb-2 border-l-2 border-hairline pl-3 text-xs leading-5 text-muted italic">
          &ldquo;{rfi.citationExcerpt}&rdquo;
        </blockquote>
      )}
      {rfi.answer && (
        <div className="rounded-xl border border-hairline bg-surface-soft/60 p-3 text-xs text-ink mb-2">
          <span className="font-semibold text-ink">Answer:</span> {rfi.answer}
        </div>
      )}
      {canAnswer && rfi.status === "OPEN" && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-hairline">
          <input
            aria-label={`Answer RFI: ${rfi.question}`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type an answer…"
            className="h-8 flex-1 min-w-[180px] rounded-lg border border-hairline bg-surface-soft px-2.5 text-xs text-ink focus:bg-canvas focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
          />
          <Button variant="secondary" className="h-8 px-3 text-xs font-semibold shadow-2xs" onClick={handleAnswer} disabled={pending || !answer.trim()}>
            Answer
          </Button>
          <Button variant="ghost" className="h-8 px-2 text-xs text-muted hover:text-ink" onClick={handleClose} disabled={pending}>
            Close
          </Button>
        </div>
      )}
      {canAnswer && rfi.status === "ANSWERED" && (
        <Button variant="ghost" className="h-7 px-2 text-xs text-muted hover:text-ink mt-2" onClick={handleClose} disabled={pending}>
          Close RFI
        </Button>
      )}
      <ErrorText>{error}</ErrorText>
    </li>
  );
}
