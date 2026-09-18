"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskDates } from "@/app/actions/tasks";
import { ErrorText } from "@/components/ui/ErrorText";
import { daysBetween, formatDate, TASK_STATUS_LABELS } from "@/lib/utils";
import type { TaskStatus } from "@prisma/client";

type GanttTask = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: TaskStatus;
  isRoadblock: boolean;
  assignedTo: { user: { name: string } } | null;
};

type DependencyEdge = { predecessorId: string; successorId: string };

const BAR_COLORS: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-surface-strong",
  IN_PROGRESS: "bg-brand-accent",
  DONE: "bg-success",
  DELAYED: "bg-error",
};

const MS_PER_DAY = 86_400_000;

type DragState = {
  taskId: string;
  mode: "move" | "resize-start" | "resize-end";
  originStart: Date;
  originEnd: Date;
  startClientX: number;
  daysDelta: number;
};

export function GanttChart({
  tasks,
  rangeStart,
  rangeEnd,
  criticalTaskIds,
  dependencies = [],
  canEdit = false,
}: {
  tasks: GanttTask[];
  rangeStart: Date;
  rangeEnd: Date;
  criticalTaskIds?: string[];
  dependencies?: DependencyEdge[];
  canEdit?: boolean;
}) {
  const totalDays = Math.max(daysBetween(rangeStart, rangeEnd), 1);
  const criticalSet = new Set(criticalTaskIds ?? []);
  const timelineRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [drag, setDrag] = useState<DragState | null>(null);
  // Optimistic date overrides while a save is in flight, so the bar doesn't snap back.
  const [overrides, setOverrides] = useState<Map<string, { startDate: Date; endDate: Date }>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [depWarning, setDepWarning] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function effectiveDates(task: GanttTask): { startDate: Date; endDate: Date } {
    const override = overrides.get(task.id);
    const base = override ?? { startDate: task.startDate, endDate: task.endDate };
    if (drag && drag.taskId === task.id) {
      const shift = (days: number, d: Date) => new Date(d.getTime() + days * MS_PER_DAY);
      if (drag.mode === "move") {
        return { startDate: shift(drag.daysDelta, drag.originStart), endDate: shift(drag.daysDelta, drag.originEnd) };
      }
      if (drag.mode === "resize-start") {
        const newStart = shift(drag.daysDelta, drag.originStart);
        return { startDate: newStart <= drag.originEnd ? newStart : drag.originEnd, endDate: drag.originEnd };
      }
      const newEnd = shift(drag.daysDelta, drag.originEnd);
      return { startDate: drag.originStart, endDate: newEnd >= drag.originStart ? newEnd : drag.originStart };
    }
    return base;
  }

  function pxPerDay(): number {
    const width = timelineRef.current?.getBoundingClientRect().width ?? 0;
    return width > 0 ? width / totalDays : 1;
  }

  function beginDrag(task: GanttTask, mode: DragState["mode"], clientX: number) {
    if (!canEdit) return;
    setError(null);
    setDepWarning(null);
    const { startDate, endDate } = effectiveDates(task);
    setDrag({ taskId: task.id, mode, originStart: startDate, originEnd: endDate, startClientX: clientX, daysDelta: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const daysDelta = Math.round((e.clientX - drag.startClientX) / pxPerDay());
    if (daysDelta !== drag.daysDelta) setDrag({ ...drag, daysDelta });
  }

  function checkDependencyViolations(taskId: string, newStart: Date, newEnd: Date): string | null {
    const datesById = new Map(tasks.map((t) => [t.id, effectiveDates(t)]));
    datesById.set(taskId, { startDate: newStart, endDate: newEnd });
    const nameById = new Map(tasks.map((t) => [t.id, t.name]));

    for (const edge of dependencies) {
      if (edge.predecessorId !== taskId && edge.successorId !== taskId) continue;
      const pred = datesById.get(edge.predecessorId);
      const succ = datesById.get(edge.successorId);
      if (!pred || !succ) continue;
      if (pred.endDate > succ.startDate) {
        return `Heads up: "${nameById.get(edge.successorId)}" now starts before its predecessor "${nameById.get(edge.predecessorId)}" finishes.`;
      }
    }
    return null;
  }

  function onPointerUp() {
    if (!drag) return;
    const task = tasks.find((t) => t.id === drag.taskId);
    const finalDates = task ? effectiveDates(task) : null;
    const changed = drag.daysDelta !== 0;
    const dragged = drag;
    setDrag(null);
    if (!task || !finalDates || !changed) return;

    // Non-blocking dependency warning (finish-to-start), per the plan.
    setDepWarning(checkDependencyViolations(dragged.taskId, finalDates.startDate, finalDates.endDate));

    setOverrides((prev) => new Map(prev).set(task.id, finalDates));
    startTransition(async () => {
      const result = await updateTaskDates({
        taskId: task.id,
        startDate: finalDates.startDate,
        endDate: finalDates.endDate,
      });
      if (!result.success) {
        setError(result.error);
        setOverrides((prev) => {
          const next = new Map(prev);
          next.delete(task.id);
          return next;
        });
      } else {
        router.refresh();
      }
    });
  }

  if (tasks.length === 0) {
    return <p className="text-sm text-muted py-8 text-center">No tasks to display yet.</p>;
  }

  return (
    <div>
      <div
        className="app-table-wrap select-none overflow-x-auto"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="flex border-b border-hairline bg-surface-soft text-xs text-muted">
          <div className="w-48 shrink-0 px-3 py-2 font-medium">Task</div>
          <div className="flex-1 px-3 py-2 flex justify-between font-medium">
            <span>{formatDate(rangeStart)}</span>
            <span>{formatDate(rangeEnd)}</span>
          </div>
        </div>
        {tasks.map((task) => {
          const { startDate, endDate } = effectiveDates(task);
          const offsetDays = Math.max(daysBetween(rangeStart, startDate), 0);
          const durationDays = Math.max(daysBetween(startDate, endDate), 1);
          const leftPct = Math.min((offsetDays / totalDays) * 100, 100);
          const widthPct = Math.min((durationDays / totalDays) * 100, 100 - leftPct);
          const isCritical = criticalSet.has(task.id);
          const isDragging = drag?.taskId === task.id;

          return (
            <div key={task.id} className="flex items-center border-b border-hairline-soft last:border-b-0">
              <div className="w-48 shrink-0 px-3 py-3 text-sm">
                <div className="font-medium text-ink truncate flex items-center gap-1.5">
                  {isCritical && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-error shrink-0" title="On critical path" />
                  )}
                  {task.name}
                </div>
                <div className="text-xs text-muted truncate">
                  {isDragging
                    ? `${formatDate(startDate)} – ${formatDate(endDate)}`
                    : task.assignedTo?.user.name ?? "Unassigned"}
                </div>
              </div>
              <div ref={task.id === tasks[0].id ? timelineRef : undefined} className="flex-1 relative h-10 px-3">
                <div className="absolute inset-y-0 my-auto h-6" style={{ left: `${leftPct}%`, width: `${widthPct}%` }}>
                  <div
                    onPointerDown={(e) => {
                      e.preventDefault();
                      beginDrag(task, "move", e.clientX);
                    }}
                    className={`group h-full rounded-md ${BAR_COLORS[task.status]} flex items-center px-2 min-w-[8px] relative ${
                      isCritical ? "ring-2 ring-error ring-offset-1" : ""
                    } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-80 shadow-md" : ""}`}
                    title={`${TASK_STATUS_LABELS[task.status]}: ${formatDate(startDate)} – ${formatDate(endDate)}${
                      isCritical ? " (critical path)" : ""
                    }${canEdit ? " — drag to reschedule" : ""}`}
                  >
                    {task.isRoadblock && <span className="text-xs pointer-events-none">⚠</span>}
                    {canEdit && (
                      <>
                        <span
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            beginDrag(task, "resize-start", e.clientX);
                          }}
                          className="absolute left-0 inset-y-0 w-2 cursor-ew-resize rounded-l-md opacity-0 group-hover:opacity-100 bg-ink/20"
                          aria-hidden
                        />
                        <span
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            beginDrag(task, "resize-end", e.clientX);
                          }}
                          className="absolute right-0 inset-y-0 w-2 cursor-ew-resize rounded-r-md opacity-0 group-hover:opacity-100 bg-ink/20"
                          aria-hidden
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs text-muted bg-surface-soft">
          {criticalSet.size > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-error" />
              Critical path — any delay on these tasks pushes out the project end date
            </span>
          )}
          {canEdit && <span>Drag a bar to reschedule; drag its edges to change duration.</span>}
        </div>
      </div>
      {depWarning && (
        <p className="text-sm text-warning mt-2" role="status">
          {depWarning}
        </p>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
