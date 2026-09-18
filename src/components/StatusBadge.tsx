import type { TaskStatus } from "@prisma/client";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/lib/utils";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[11px] font-semibold ${TASK_STATUS_COLORS[status]}`}
    >
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}
