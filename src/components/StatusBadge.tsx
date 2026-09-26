import type { TaskStatus } from "@prisma/client";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/lib/utils";

const STATUS_DOT: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-muted-soft",
  IN_PROGRESS: "bg-brand-accent",
  DONE: "bg-success",
  DELAYED: "bg-error",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[11px] font-semibold tracking-tight shadow-[0_1px_2px_rgba(15,23,42,0.02)] ${TASK_STATUS_COLORS[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}
