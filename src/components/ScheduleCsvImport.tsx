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
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, UploadCloud, X } from "lucide-react";

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
      <Button variant="secondary" onClick={() => setOpen(true)} className="gap-1.5 shadow-sm">
        <UploadCloud className="h-4 w-4" />
        <span>Import CSV</span>
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
      className={`w-full min-w-0 rounded-2xl border bg-surface-card p-6 shadow-card transition-all ${
        dragging ? "border-brand-accent ring-2 ring-brand-accent/20 bg-brand-accent/5" : "border-hairline"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent shrink-0">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink">Import Schedule from CSV</h3>
            <p className="text-xs text-muted mt-0.5" id={hintId}>
              One activity per row ({SCHEDULE_CSV_COLUMNS.join(", ")}). Dates formatted as DD-MM-YYYY (e.g. 01-10-2026).
            </p>
          </div>
        </div>

        <Button type="button" variant="secondary" onClick={downloadTemplate} className="gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          <span>Download Template</span>
        </Button>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted">
        Separate predecessors with{" "}
        <code className="rounded-md bg-surface-soft border border-hairline px-1.5 py-0.5 font-mono text-[11px] text-ink font-semibold">
          {PREDECESSOR_SEPARATOR}
        </code>{" "}
        and reference other activities by their exact task name.
      </p>

      {/* Dropzone */}
      <div className="mt-4">
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
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-brand-accent ${
            dragging
              ? "border-brand-accent bg-brand-accent/10"
              : "border-hairline bg-canvas hover:border-brand-accent/50 hover:bg-surface-soft/40"
          }`}
        >
          <UploadCloud className="h-8 w-8 text-muted mb-1" />
          <span className="text-sm font-semibold text-ink">
            {dragging ? "Release file to preview" : "Drop CSV file here, or click to browse"}
          </span>
          <span className="text-xs text-muted">
            {fileName ?? "Nothing is written to the schedule until you preview and confirm below."}
          </span>
        </label>
      </div>

      {parsed && (
        <div className="mt-4">
          {fatalError ? (
            <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-center text-xs font-medium text-error flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{fatalError}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">CSV Preview</span>
                <span className="text-xs font-mono text-muted tabular-nums">
                  {parsed.summary.total} rows &middot; {parsed.summary.toCreate} new &middot; {parsed.summary.toUpdate} updates
                  {errorCount > 0 && (
                    <span className="text-error font-semibold ml-1">({errorCount} errors)</span>
                  )}
                </span>
              </div>
              <PreviewTable entries={buildPreviewEntries(parsed)} />
            </>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline-soft pt-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleImport}
            disabled={!canImport || importing}
            aria-describedby={blockedByErrors || blockedByEmpty ? blockedId : undefined}
            className="gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{importing ? "Importing…" : "Apply Schedule Import"}</span>
          </Button>
          <Button type="button" variant="secondary" onClick={close} disabled={importing}>
            Cancel
          </Button>
        </div>

        {blockedByErrors && (
          <p id={blockedId} className="text-xs text-error font-medium">
            Imports are all-or-nothing. Fix {errorCount === 1 ? "the flagged row" : `all ${errorCount} flagged rows`} to proceed.
          </p>
        )}
        {blockedByEmpty && (
          <p id={blockedId} className="text-xs text-muted">
            This file has no activity rows to import.
          </p>
        )}
      </div>

      {error && (
        <div id={errorId} role="alert" className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </div>
  );
}

function PreviewTable({ entries }: { entries: PreviewEntry[] }) {
  return (
    <div className="max-h-80 overflow-auto rounded-xl border border-hairline bg-canvas shadow-inner">
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
            <th className="app-table-heading py-2.5 pl-3 pr-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) =>
            entry.kind === "error" ? (
              <tr key={`error-${entry.lineNumber}`} className="border-b border-hairline-soft bg-error/5 last:border-b-0">
                <td className="border-r border-hairline-soft py-2.5 pl-4 pr-3 text-center font-mono text-xs text-error font-semibold">
                  {entry.lineNumber}
                </td>
                <td className="px-3 py-2.5 font-medium text-ink">
                  {entry.error.taskName ?? <span className="text-muted-soft">No task name</span>}
                </td>
                <td colSpan={PREVIEW_COLUMN_COUNT - 2} className="py-2.5 pl-3 pr-4">
                  <ul className="space-y-0.5">
                    {entry.error.messages.map((message) => (
                      <li key={message} className="text-xs leading-5 text-error flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{message}</span>
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
                <td className="whitespace-nowrap px-3 py-2.5 text-muted font-mono text-xs">{formatIsoDate(entry.row.startDate)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted font-mono text-xs">{formatIsoDate(entry.row.endDate)}</td>
                <td className="px-3 py-2.5">
                  {entry.row.assigneeEmail ? (
                    <span className="text-body text-xs font-mono">{entry.row.assigneeEmail}</span>
                  ) : (
                    <span className="text-muted-soft text-xs">Unassigned</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={entry.row.status} />
                </td>
                <td className="px-3 py-2.5 text-muted text-xs">
                  {entry.row.predecessorNames.length > 0 ? (
                    entry.row.predecessorNames.join(", ")
                  ) : (
                    <span className="text-muted-soft">None</span>
                  )}
                </td>
                <td className="py-2.5 pl-3 pr-4 text-right">
                  <span
                    className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${
                      entry.row.action === "create" ? "bg-success/15 text-success border border-success/30" : "bg-brand-accent/15 text-brand-accent border border-brand-accent/30"
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
