import type { TaskStatus } from "@prisma/client";

/**
 * Shared contract for the bulk schedule CSV import.
 *
 * This module is deliberately pure: no Prisma, no I/O, no React. The browser
 * uses it to render an instant preview of an uploaded file, and the server
 * action re-runs the exact same parse over the same text before writing
 * anything. The preview is a convenience; the server parse is the authority.
 */

/** Header row of the template, in order. Also the columns the parser expects. */
export const SCHEDULE_CSV_COLUMNS = [
  "Task Name",
  "Assignee Email",
  "Start Date",
  "End Date",
  "Status",
  "Progress %",
  "Predecessors",
] as const;

/** Predecessors are semicolon-separated so task names may contain commas. */
export const PREDECESSOR_SEPARATOR = ";";

/**
 * The downloadable starter file. Single source of truth: the download button
 * and the format documentation in the import panel both read from here.
 */
export const SCHEDULE_CSV_TEMPLATE = `Task Name,Assignee Email,Start Date,End Date,Status,Progress %,Predecessors
Site Mobilization,super@example.com,2026-10-01,2026-10-05,DONE,100,
Excavation,grading@example.com,2026-10-06,2026-10-17,IN_PROGRESS,40,Site Mobilization
Footing Formwork,concrete@example.com,2026-10-20,2026-10-28,NOT_STARTED,0,Excavation
Footing Pour,concrete@example.com,2026-10-29,2026-10-31,NOT_STARTED,0,Footing Formwork
Backfill & Compaction,grading@example.com,2026-11-02,2026-11-06,NOT_STARTED,0,Footing Pour;Excavation
`;

export const SCHEDULE_CSV_TEMPLATE_FILENAME = "schedule-template.csv";

/** A project member the CSV may assign work to, keyed by login email. */
export type ScheduleCsvMember = { id: string; email: string; name: string };

/** A task already on the project, used to decide create-vs-update. */
export type ScheduleCsvExistingTask = { id: string; name: string };

export type ScheduleCsvContext = {
  members: ScheduleCsvMember[];
  existingTasks: ScheduleCsvExistingTask[];
};

/** One fully validated row, normalized and ready to write. */
export type ScheduleCsvRow = {
  /** 1-based line number in the source file, header included, for error display. */
  lineNumber: number;
  name: string;
  assigneeMemberId: string | null;
  assigneeEmail: string | null;
  /** Normalized to ISO `YYYY-MM-DD`, regardless of the input format. */
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progress: number;
  /** Predecessor task names exactly as they resolve, in file order. */
  predecessorNames: string[];
  action: "create" | "update";
  /** Set when `action` is "update"; the existing task this row overwrites. */
  existingTaskId: string | null;
};

/** Everything wrong with one row, collected together rather than first-error-wins. */
export type ScheduleCsvRowError = {
  lineNumber: number;
  taskName: string | null;
  messages: string[];
};

export type ScheduleCsvSummary = {
  total: number;
  toCreate: number;
  toUpdate: number;
  errorCount: number;
};

export type ScheduleCsvParseResult = {
  rows: ScheduleCsvRow[];
  errors: ScheduleCsvRowError[];
  summary: ScheduleCsvSummary;
  /** File-level problems (empty file, missing/misspelled headers) that stop parsing. */
  fatalError: string | null;
};

type CsvRecord = {
  cells: string[];
  /** 1-based physical line the record starts on. Records may span lines. */
  line: number;
};

const VALID_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "DONE", "DELAYED"] as const;

/** Same shape as `parseCsvGrid`, but keeps the physical line each record starts on. */
function tokenizeCsv(text: string): CsvRecord[] {
  const source = text.startsWith("﻿") ? text.slice(1) : text;
  const records: CsvRecord[] = [];

  let cells: string[] = [];
  let field = "";
  let fieldQuoted = false;
  let inQuotes = false;
  /** Whether anything at all has been consumed for the record being built. */
  let started = false;
  let line = 1;
  let recordLine = 1;

  const endRecord = () => {
    cells.push(field);
    records.push({ cells, line: recordLine });
    cells = [];
    field = "";
    fieldQuoted = false;
    started = false;
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
        continue;
      }
      field += char;
      if (char === "\n" || (char === "\r" && source[i + 1] !== "\n")) line++;
      continue;
    }

    if (char === '"' && field === "" && !fieldQuoted) {
      inQuotes = true;
      fieldQuoted = true;
      started = true;
      continue;
    }

    if (char === ",") {
      cells.push(field);
      field = "";
      fieldQuoted = false;
      started = true;
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
      continue;
    }

    field += char;
    started = true;
  }

  if (started) endRecord();
  return records;
}

/** Header cells and column names are matched on this key. */
function normalizeHeader(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Reads a column from a record, treating missing trailing cells as blank. */
function cellAt(record: CsvRecord, index: number): string {
  return record.cells[index] ?? "";
}

/** Accepts ISO `YYYY-MM-DD` and US `M/D/YYYY`, returning ISO. Null if impossible. */
function parseDate(raw: string): string | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);

  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (us) {
    [year, month, day] = [Number(us[3]), Number(us[1]), Number(us[2])];
  } else {
    return null;
  }

  // Round-trip through Date to reject overflow like 2026-02-30 or 13/45/2026.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Accepts `40`, `40%` and a clean `40.0`; rejects genuine fractions. */
function parseProgress(raw: string): number | null {
  let value = raw.trim();
  if (value.endsWith("%")) value = value.slice(0, -1).trim();
  if (!/^-?\d+(\.\d+)?$/.test(value)) return null;

  const progress = Number(value);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return null;
  return progress;
}

/** Treats spaces and hyphens as underscores, so "In Progress" resolves. */
function parseStatus(raw: string): TaskStatus | null {
  const value = raw.trim().replace(/[\s-]+/g, "_").toUpperCase();
  return (VALID_STATUSES as readonly string[]).includes(value) ? (value as TaskStatus) : null;
}

type FileEdge = { from: number; to: number };

/**
 * Removes every node that cannot be on a cycle: first the sources (Kahn's
 * algorithm), then the sinks left behind. What survives both peels is exactly
 * the set of nodes participating in a cycle, so rows merely *downstream* of a
 * cycle are not blamed for it.
 */
function peelAcyclic(alive: Set<number>, edges: FileEdge[], direction: "forward" | "backward"): void {
  const counted = (edge: FileEdge) => (direction === "forward" ? edge.to : edge.from);
  const owner = (edge: FileEdge) => (direction === "forward" ? edge.from : edge.to);

  const degree = new Map<number, number>();
  const outgoing = new Map<number, FileEdge[]>();
  for (const node of alive) {
    degree.set(node, 0);
    outgoing.set(node, []);
  }
  for (const edge of edges) {
    if (!alive.has(edge.from) || !alive.has(edge.to)) continue;
    degree.set(counted(edge), (degree.get(counted(edge)) ?? 0) + 1);
    outgoing.get(owner(edge))?.push(edge);
  }

  const queue = [...alive].filter((node) => degree.get(node) === 0);
  while (queue.length > 0) {
    const node = queue.pop() as number;
    alive.delete(node);
    for (const edge of outgoing.get(node) ?? []) {
      const target = counted(edge);
      const remaining = (degree.get(target) ?? 0) - 1;
      degree.set(target, remaining);
      if (remaining === 0 && alive.has(target)) queue.push(target);
    }
  }
}

function findCyclicRows(nodeCount: number, edges: FileEdge[]): Set<number> {
  const alive = new Set<number>();
  for (let i = 0; i < nodeCount; i++) alive.add(i);
  peelAcyclic(alive, edges, "forward");
  peelAcyclic(alive, edges, "backward");
  return alive;
}

/** A data row mid-validation, before it is split into `rows` or `errors`. */
type PendingRow = {
  lineNumber: number;
  name: string;
  normalizedName: string;
  messages: string[];
  assigneeMemberId: string | null;
  assigneeEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  status: TaskStatus;
  progress: number;
  rawPredecessors: string[];
  predecessorNames: string[];
};

function emptyResult(fatalError: string): ScheduleCsvParseResult {
  return {
    rows: [],
    errors: [],
    summary: { total: 0, toCreate: 0, toUpdate: 0, errorCount: 0 },
    fatalError,
  };
}

/**
 * Splits RFC 4180 CSV text into a grid of raw cells. Handles quoted fields,
 * embedded commas and newlines, `""` escapes, CRLF, and a leading BOM.
 * Exported so the parser's tokenizing can be tested on its own.
 */
export function parseCsvGrid(text: string): string[][] {
  return tokenizeCsv(text).map((record) => record.cells);
}

/** Trim + casefold, so "Excavation " and "excavation" match the same task. */
export function normalizeTaskName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Parses and validates an uploaded schedule CSV against the project's members
 * and existing tasks. Never throws on bad input: malformed rows come back in
 * `errors`, and a file too broken to read at all comes back in `fatalError`.
 */
export function parseScheduleCsv(text: string, context: ScheduleCsvContext): ScheduleCsvParseResult {
  const records = tokenizeCsv(text);
  const isBlank = (record: CsvRecord) => record.cells.every((cell) => cell.trim() === "");

  const headerIndex = records.findIndex((record) => !isBlank(record));
  if (headerIndex === -1) return emptyResult("The file has no task rows.");

  const headerPositions = new Map<string, number>();
  records[headerIndex].cells.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (key !== "" && !headerPositions.has(key)) headerPositions.set(key, index);
  });

  const missing = SCHEDULE_CSV_COLUMNS.filter((column) => !headerPositions.has(normalizeHeader(column)));
  if (missing.length > 0) return emptyResult(`Missing required column(s): ${missing.join(", ")}`);

  const columnAt = (column: (typeof SCHEDULE_CSV_COLUMNS)[number]) =>
    headerPositions.get(normalizeHeader(column)) as number;

  const dataRecords = records.slice(headerIndex + 1).filter((record) => !isBlank(record));
  if (dataRecords.length === 0) return emptyResult("The file has no task rows.");

  const membersByEmail = new Map(context.members.map((member) => [member.email.trim().toLowerCase(), member]));
  const existingByName = new Map<string, ScheduleCsvExistingTask>();
  for (const task of context.existingTasks) {
    const key = normalizeTaskName(task.name);
    if (!existingByName.has(key)) existingByName.set(key, task);
  }

  const pending: PendingRow[] = dataRecords.map((record) => {
    const messages: string[] = [];
    const name = cellAt(record, columnAt("Task Name")).trim();
    if (name === "") messages.push("Task Name is required");
    else if (name.length > 200) messages.push("Task Name must be 200 characters or fewer");

    const rawEmail = cellAt(record, columnAt("Assignee Email")).trim();
    let member: ScheduleCsvMember | undefined;
    if (rawEmail !== "") {
      member = membersByEmail.get(rawEmail.toLowerCase());
      if (!member) messages.push(`No project member has the email "${rawEmail}"`);
    }

    const rawStart = cellAt(record, columnAt("Start Date")).trim();
    const rawEnd = cellAt(record, columnAt("End Date")).trim();
    const startDate = rawStart === "" ? null : parseDate(rawStart);
    const endDate = rawEnd === "" ? null : parseDate(rawEnd);
    if (rawStart === "") messages.push("Start Date is required");
    else if (startDate === null) messages.push(`Start Date "${rawStart}" is not a valid date (use YYYY-MM-DD)`);
    if (rawEnd === "") messages.push("End Date is required");
    else if (endDate === null) messages.push(`End Date "${rawEnd}" is not a valid date (use YYYY-MM-DD)`);
    if (startDate !== null && endDate !== null && endDate < startDate) {
      messages.push("End Date must be on or after Start Date");
    }

    const rawStatus = cellAt(record, columnAt("Status")).trim();
    const status = rawStatus === "" ? "NOT_STARTED" : parseStatus(rawStatus);
    if (status === null) {
      messages.push(`Status "${rawStatus}" must be one of ${VALID_STATUSES.join(", ")}`);
    }

    const rawProgress = cellAt(record, columnAt("Progress %")).trim();
    const progress = rawProgress === "" ? 0 : parseProgress(rawProgress);
    if (progress === null) messages.push("Progress % must be a whole number between 0 and 100");

    return {
      lineNumber: record.line,
      name,
      normalizedName: normalizeTaskName(name),
      messages,
      assigneeMemberId: member?.id ?? null,
      assigneeEmail: member?.email ?? null,
      startDate,
      endDate,
      status: status ?? "NOT_STARTED",
      progress: progress ?? 0,
      rawPredecessors: cellAt(record, columnAt("Predecessors"))
        .split(PREDECESSOR_SEPARATOR)
        .map((entry) => entry.trim())
        .filter((entry) => entry !== ""),
      predecessorNames: [],
    };
  });

  const rowsByName = new Map<string, number>();
  pending.forEach((row, index) => {
    if (row.normalizedName !== "" && !rowsByName.has(row.normalizedName)) rowsByName.set(row.normalizedName, index);
  });

  const edges: FileEdge[] = [];
  pending.forEach((row, index) => {
    for (const raw of row.rawPredecessors) {
      const key = normalizeTaskName(raw);
      if (key !== "" && key === row.normalizedName) {
        row.messages.push("A task cannot be its own predecessor");
        continue;
      }
      const fileRowIndex = rowsByName.get(key);
      if (fileRowIndex !== undefined) {
        row.predecessorNames.push(pending[fileRowIndex].name);
        edges.push({ from: fileRowIndex, to: index });
        continue;
      }
      const existing = existingByName.get(key);
      if (existing) {
        row.predecessorNames.push(existing.name);
        continue;
      }
      row.messages.push(`Predecessor "${raw}" does not match any task in this file or in the project`);
    }
  });

  const linesByName = new Map<string, number[]>();
  for (const row of pending) {
    if (row.normalizedName === "") continue;
    const lines = linesByName.get(row.normalizedName) ?? [];
    lines.push(row.lineNumber);
    linesByName.set(row.normalizedName, lines);
  }
  for (const row of pending) {
    const others = (linesByName.get(row.normalizedName) ?? []).filter((line) => line !== row.lineNumber);
    if (others.length === 0) continue;
    const where = others.length === 1 ? `line ${others[0]}` : `lines ${others.join(", ")}`;
    row.messages.push(`Duplicate Task Name "${row.name}" also appears on ${where}`);
  }

  for (const index of findCyclicRows(pending.length, edges)) {
    pending[index].messages.push("Predecessors form a circular dependency");
  }

  const rows: ScheduleCsvRow[] = [];
  const errors: ScheduleCsvRowError[] = [];
  for (const row of pending) {
    if (row.messages.length > 0) {
      errors.push({
        lineNumber: row.lineNumber,
        taskName: row.name === "" ? null : row.name,
        messages: row.messages,
      });
      continue;
    }
    const existing = existingByName.get(row.normalizedName);
    rows.push({
      lineNumber: row.lineNumber,
      name: row.name,
      assigneeMemberId: row.assigneeMemberId,
      assigneeEmail: row.assigneeEmail,
      startDate: row.startDate as string,
      endDate: row.endDate as string,
      status: row.status,
      progress: row.progress,
      predecessorNames: row.predecessorNames,
      action: existing ? "update" : "create",
      existingTaskId: existing?.id ?? null,
    });
  }

  return {
    rows,
    errors,
    summary: {
      total: pending.length,
      toCreate: rows.filter((row) => row.action === "create").length,
      toUpdate: rows.filter((row) => row.action === "update").length,
      errorCount: errors.length,
    },
    fatalError: null,
  };
}
