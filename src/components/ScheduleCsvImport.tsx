"use client";

import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { importScheduleCsv } from "@/app/actions/schedule-import";
import {
  parseScheduleCsv,
  PREDECESSOR_SEPARATOR,
  SCHEDULE_CSV_COLUMNS,
  SCHEDULE_CSV_TEMPLATE,
  SCHEDULE_CSV_TEMPLATE_FILENAME,
  type ScheduleCsvExistingTask,
  type ScheduleCsvMember,
  type ScheduleCsvParseResult,
  type ScheduleCsvRow,
  type ScheduleCsvRowError,
} from "@/lib/schedule-csv";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/utils";

/** Erroring lines come first so the user sees what to fix without scrolling. */
type PreviewEntry =
  | { kind: "error"; lineNumber: number; error: ScheduleCsvRowError }
  | { kind: "row"; lineNumber: number; row: ScheduleCsvRow };

const PREVIEW_COLUMN_COUNT = 8;

/** CSV dates are calendar days, so parse them as local time or the day shifts. */
function formatIsoDate(isoDay: string): string {
  return formatDate(`${isoDay}T00:00:00`);
}

function buildPreviewEntries(parsed: ScheduleCsvParseResult): PreviewEntry[] {
  const byLine = (a: PreviewEntry, b: PreviewEntry) => a.lineNumber - b.lineNumber;
  const errors: PreviewEntry[] = parsed.errors
    .map((error) => ({ kind: "error" as const, lineNumber: error.lineNumber, error }))
    .sort(byLine);
  const rows: PreviewEntry[] = parsed.rows
    .map((row) => ({ kind: "row" as const, lineNumber: row.lineNumber, row }))
    .sort(byLine);
  return [...errors, ...rows];
}

export function ScheduleCsvImport({
  projectId,
  members,
  existingTasks,
}: {
  projectId: string;
  members: ScheduleCsvMember[];
  existingTasks: ScheduleCsvExistingTask[];
}) {
  const router = useRouter();
  const fileInputId = useId();
  const hintId = useId();
  const errorId = useId();
  const blockedId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ScheduleCsvParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function resetFile() {
    setFileName(null);
    setCsvText(null);
    setParsed(null);
    setError(null);
    setDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function close() {
    resetFile();
    setOpen(false);
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([SCHEDULE_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = SCHEDULE_CSV_TEMPLATE_FILENAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      setCsvText(text);
      setParsed(parseScheduleCsv(text, { members, existingTasks }));
    } catch {
      setCsvText(null);
      setParsed(null);
      setError("That file could not be read. Export it again as a .csv and retry.");
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function handleImport() {
    if (!csvText) return;
    setError(null);
    setImporting(true);
    const result = await importScheduleCsv({ projectId, csvText });
    setImporting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    close();
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M4 21h16" />
        </svg>
        Import CSV
      </Button>
    );
  }

  const rowCount = parsed?.rows.length ?? 0;
  const errorCount = parsed?.errors.length ?? 0;
  const fatalError = parsed?.fatalError ?? null;
  const blockedByErrors = errorCount > 0;
  const blockedByEmpty = parsed !== null && !fatalError && errorCount === 0 && rowCount === 0;
  const canImport = parsed !== null && !fatalError && !blockedByErrors && rowCount > 0;

  return (
    <div
      data-panel-open
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full min-w-0 rounded-md border bg-surface-soft p-4 transition-colors ${
        dragging ? "border-brand-accent bg-brand-accent/5" : "border-hairline"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="app-section-title">Import schedule from CSV</p>
          <p className="app-section-description" id={hintId}>
            One activity per row, with the columns {SCHEDULE_CSV_COLUMNS.join(", ")}. Dates should be formatted as DD-MM-YYYY (e.g. 01-10-2026). Rows naming an
            existing activity update it, the rest are created.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={downloadTemplate}>
          Download template
        </Button>
      </div>

      <p className="mt-2 text-xs leading-5 text-muted">
        Separate predecessors with{" "}
        <code className="rounded-sm bg-surface-strong px-1 py-0.5 font-mono text-[11px] text-ink">
          {PREDECESSOR_SEPARATOR}
        </code>{" "}
        and reference other activities by their exact task name.
      </p>

      <div className="mt-3">
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept=".csv,text/csv"
          onChange={handleInputChange}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          className="peer sr-only"
        />
        <label
          htmlFor={fileInputId}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-6 text-center transition-colors peer-focus-visible:border-ink peer-focus-visible:ring-2 peer-focus-visible:ring-ink/20 ${
            dragging ? "border-brand-accent bg-brand-accent/10" : "border-hairline bg-canvas hover:border-muted-soft"
          }`}
        >
          <span className="text-sm font-semibold text-ink">
            {dragging ? "Drop the file to preview it" : "Drop a CSV here, or choose a file"}
          </span>
          <span className="text-xs text-muted">
            {fileName ?? "Nothing is written until you review the preview and confirm."}
          </span>
        </label>
      </div>

      {parsed && (
        <div className="mt-3">
          {fatalError ? (
            <p className="rounded-md border border-hairline bg-canvas px-4 py-6 text-center text-sm text-error">
              {fatalError}
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-muted">
                {parsed.summary.total} {parsed.summary.total === 1 ? "row" : "rows"} ·{" "}
                {parsed.summary.toCreate} new · {parsed.summary.toUpdate}{" "}
                {parsed.summary.toUpdate === 1 ? "update" : "updates"}
                {errorCount > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold text-error">
                      {errorCount} {errorCount === 1 ? "error" : "errors"}
                    </span>
                  </>
                )}
              </p>
              <PreviewTable entries={buildPreviewEntries(parsed)} />
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleImport}
          disabled={!canImport || importing}
          aria-describedby={blockedByErrors || blockedByEmpty ? blockedId : undefined}
        >
          {importing ? "Importing…" : "Import"}
        </Button>
        <Button type="button" variant="secondary" onClick={close} disabled={importing}>
          Cancel
        </Button>
        {blockedByErrors && (
          <p id={blockedId} className="text-xs leading-5 text-muted">
            Imports are all or nothing. Fix {errorCount === 1 ? "the flagged row" : `all ${errorCount} flagged rows`} and
            upload the file again.
          </p>
        )}
        {blockedByEmpty && (
          <p id={blockedId} className="text-xs leading-5 text-muted">
            This file has no activity rows to import.
          </p>
        )}
      </div>

      <div id={errorId} role="alert">
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  );
}

function PreviewTable({ entries }: { entries: PreviewEntry[] }) {
  return (
    <div className="mt-2 max-h-80 overflow-auto rounded-md border border-hairline bg-canvas shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-hairline bg-surface-soft text-left">
            <th className="app-table-heading w-12 border-r border-hairline-soft py-2.5 pl-4 pr-3 text-center">Line</th>
            <th className="app-table-heading px-3 py-2.5">Task</th>
            <th className="app-table-heading whitespace-nowrap px-3 py-2.5">Start</th>
            <th className="app-table-heading whitespace-nowrap px-3 py-2.5">End</th>
            <th className="app-table-heading px-3 py-2.5">Responsible</th>
            <th className="app-table-heading px-3 py-2.5">Status</th>
            <th className="app-table-heading px-3 py-2.5">Predecessors</th>
            <th className="app-table-heading py-2.5 pl-3 pr-4 text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) =>
            entry.kind === "error" ? (
              <tr key={`error-${entry.lineNumber}`} className="border-b border-hairline-soft bg-error/5 last:border-b-0">
                <td className="border-r border-hairline-soft py-2.5 pl-4 pr-3 text-center font-mono text-xs text-error">
                  {entry.lineNumber}
                </td>
                <td className="px-3 py-2.5 font-medium text-ink">
                  {entry.error.taskName ?? <span className="text-muted-soft">No task name</span>}
                </td>
                <td colSpan={PREVIEW_COLUMN_COUNT - 2} className="py-2.5 pl-3 pr-4">
                  <ul className="space-y-0.5">
                    {entry.error.messages.map((message) => (
                      <li key={message} className="text-xs leading-5 text-error">
                        {message}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ) : (
              <tr
                key={`row-${entry.lineNumber}`}
                className="app-table-row border-b border-hairline-soft align-middle last:border-b-0"
              >
                <td className="border-r border-hairline-soft py-2.5 pl-4 pr-3 text-center font-mono text-xs text-muted-soft">
                  {entry.lineNumber}
                </td>
                <td className="px-3 py-2.5 font-medium text-ink">{entry.row.name}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted">{formatIsoDate(entry.row.startDate)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted">{formatIsoDate(entry.row.endDate)}</td>
                <td className="px-3 py-2.5">
                  {entry.row.assigneeEmail ? (
                    <span className="text-body">{entry.row.assigneeEmail}</span>
                  ) : (
                    <span className="text-muted-soft">Unassigned</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={entry.row.status} />
                </td>
                <td className="px-3 py-2.5 text-muted">
                  {entry.row.predecessorNames.length > 0 ? (
                    entry.row.predecessorNames.join(", ")
                  ) : (
                    <span className="text-muted-soft">None</span>
                  )}
                </td>
                <td className="py-2.5 pl-3 pr-4 text-right">
                  <span
                    className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[11px] font-semibold ${
                      entry.row.action === "create" ? "bg-success/15 text-success" : "bg-brand-accent/15 text-brand-accent"
                    }`}
                  >
                    {entry.row.action === "create" ? "New" : "Update"}
                  </span>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
