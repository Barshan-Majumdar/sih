import type {
  TaskStatus,
  ProjectRole,
  RoadblockType,
  CommitmentStatus,
  SirStatus,
  SubmittalStatus,
  RfiStatus,
} from "@prisma/client";

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function daysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

export function percentComplete(total: number, done: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  DELAYED: "Delayed",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-surface-strong text-body",
  IN_PROGRESS: "bg-brand-accent/15 text-brand-accent",
  DONE: "bg-success/15 text-success",
  DELAYED: "bg-error/15 text-error",
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  PROJECT_MANAGER: "Project Manager",
  SCHEDULER: "Scheduler",
  SUPERINTENDENT: "Superintendent",
  TRADE: "Trade Partner",
};

export const ROADBLOCK_TYPE_LABELS: Record<RoadblockType, string> = {
  CHANGE_ORDER: "Change Order",
  INSPECTION: "Inspection",
  LABOR: "Labor",
  MATERIAL: "Material Availability",
  WEATHER: "Weather",
  OTHER: "Other",
};

export const COMMITMENT_STATUS_LABELS: Record<CommitmentStatus, string> = {
  COMMITTED: "Committed",
  COMPLETED: "Completed",
  NOT_COMPLETED: "Not Completed",
};

export const SIR_STATUS_LABELS: Record<SirStatus, string> = {
  PENDING: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const SUBMITTAL_STATUS_LABELS: Record<SubmittalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVISE_RESUBMIT: "Revise & Resubmit",
};

export const RFI_STATUS_LABELS: Record<RfiStatus, string> = {
  OPEN: "Open",
  ANSWERED: "Answered",
  CLOSED: "Closed",
};

/** Returns the canonical Monday for a week at noon UTC to avoid timezone date shifts. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

export function generateInviteExpiry(days = 7): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
