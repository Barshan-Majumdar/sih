"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskDates } from "@/app/actions/tasks";
import { ErrorText } from "@/components/ui/ErrorText";
import { daysBetween, formatDate, TASK_STATUS_LABELS } from "@/lib/utils";
import type { TaskStatus } from "@prisma/client";
import { AlertCircle, AlertTriangle, Calendar, CheckCircle2, Clock, MoveHorizontal } from "lucide-react";

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

const BAR_STYLES: Record<TaskStatus, { bg: string; text: string }> = {
  NOT_STARTED: { bg: "bg-muted-soft/80 border-muted-soft text-body", text: "text-muted" },
  IN_PROGRESS: { bg: "bg-brand-accent text-white shadow-sm", text: "text-brand-accent" },
  DONE: { bg: "bg-success text-white shadow-sm", text: "text-success" },
  DELAYED: { bg: "bg-error text-white shadow-sm", text: "text-error" },
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
        return `Heads up: "${nameById.get(edge.successorId)}" starts before predecessor "${nameById.get(edge.predecessorId)}" finishes.`;
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
    return (
      <div className="rounded-2xl border border-hairline bg-surface-card p-12 text-center shadow-card">
        <Calendar className="mx-auto h-8 w-8 text-muted mb-2" />
        <p className="app-empty-title text-sm">No tasks in schedule</p>
        <p className="text-xs text-muted mt-1">Activities added to the schedule will render here in CPM Gantt format.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface-card shadow-card overflow-hidden">
      {/* Chart Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-hairline bg-surface-soft/60 px-5 py-3 gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-ink uppercase tracking-wider">Master CPM Timeline</span>
            <span className="ml-2 text-xs font-mono text-muted tabular-nums">({totalDays} days window)</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-muted">
            <span className="h-2 w-2 rounded-full bg-surface-strong" /> Not Started
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-muted">
            <span className="h-2 w-2 rounded-full bg-brand-accent" /> In Progress
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-muted">
            <span className="h-2 w-2 rounded-full bg-success" /> Done
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-muted">
            <span className="h-2 w-2 rounded-full bg-error" /> Delayed
          </span>
          {criticalSet.size > 0 && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-error">
              <span className="h-2 w-2 rounded-full bg-error animate-ping" /> Critical Path
            </span>
          )}
        </div>
      </div>

      {/* Main Interactive Gantt Workspace */}
      <div
        className="select-none overflow-x-auto"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="min-w-[850px]">
          {/* Timeline Date Header */}
          <div className="flex border-b border-hairline bg-surface-soft text-xs text-muted font-medium">
            <div className="w-56 shrink-0 px-4 py-2.5 border-r border-hairline">Activity & Assignee</div>
            <div className="flex-1 px-4 py-2.5 flex justify-between font-mono">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted" /> {formatDate(rangeStart)}
              </span>
              <span className="text-muted-soft font-normal text-[11px]">Timeline scale</span>
              <span className="inline-flex items-center gap-1">
                {formatDate(rangeEnd)} <Clock className="h-3 w-3 text-muted" />
              </span>
            </div>
          </div>

          {/* Task Rows */}
          <div className="divide-y divide-hairline-soft">
            {tasks.map((task) => {
              const { startDate, endDate } = effectiveDates(task);
              const offsetDays = Math.max(daysBetween(rangeStart, startDate), 0);
              const durationDays = Math.max(daysBetween(startDate, endDate), 1);
              const leftPct = Math.min((offsetDays / totalDays) * 100, 100);
              const widthPct = Math.min((durationDays / totalDays) * 100, 100 - leftPct);
              const isCritical = criticalSet.has(task.id);
              const isDragging = drag?.taskId === task.id;
              const style = BAR_STYLES[task.status];

              return (
                <div
                  key={task.id}
                  className="flex items-center transition-colors hover:bg-surface-soft/40"
                >
                  <div className="w-56 shrink-0 px-4 py-3 text-sm border-r border-hairline">
                    <div className="font-semibold text-ink truncate flex items-center gap-1.5">
                      {isCritical && (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-error shrink-0 ring-2 ring-error/20"
                          title="On Critical Path (0 Float)"
                        />
                      )}
                      <span className="truncate">{task.name}</span>
                    </div>
                    <div className="text-xs text-muted truncate mt-0.5 font-mono">
                      {isDragging
                        ? `${formatDate(startDate)} – ${formatDate(endDate)} (${durationDays}d)`
                        : task.assignedTo?.user.name ?? "Unassigned"}
                    </div>
                  </div>

                  <div
                    ref={task.id === tasks[0].id ? timelineRef : undefined}
                    className="flex-1 relative h-12 px-4"
                  >
                    {/* Background grid guide line */}
                    <div className="absolute inset-x-4 inset-y-0 flex justify-between pointer-events-none opacity-20">
                      <div className="border-r border-hairline h-full" />
                      <div className="border-r border-hairline h-full" />
                      <div className="border-r border-hairline h-full" />
                      <div className="border-r border-hairline h-full" />
                    </div>

                    <div
                      className="absolute inset-y-0 my-auto h-7"
                      style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 1.5)}%` }}
                    >
                      <div
                        onPointerDown={(e) => {
                          e.preventDefault();
                          beginDrag(task, "move", e.clientX);
                        }}
                        className={`group h-full rounded-lg ${style.bg} flex items-center justify-between px-2.5 min-w-[20px] relative transition-shadow ${
                          isCritical ? "ring-2 ring-error ring-offset-2 ring-offset-canvas shadow-sm" : ""
                        } ${canEdit ? "cursor-grab active:cursor-grabbing hover:brightness-105" : ""} ${
                          isDragging ? "opacity-90 shadow-lg scale-[1.02]" : ""
                        }`}
                        title={`${TASK_STATUS_LABELS[task.status]}: ${formatDate(startDate)} – ${formatDate(endDate)} (${durationDays}d)${
                          isCritical ? " — CRITICAL PATH" : ""
                        }${canEdit ? " (drag bar to shift, edges to resize)" : ""}`}
                      >
                        <div className="flex items-center gap-1 truncate text-xs font-semibold">
                          {task.isRoadblock && (
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-amber-500/90 text-white shrink-0" title="Roadblocked">
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          )}
                          <span className="truncate text-[11px] drop-shadow-sm">{task.name}</span>
                        </div>

                        {canEdit && (
                          <>
                            {/* Left resize handle */}
                            <span
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                beginDrag(task, "resize-start", e.clientX);
                              }}
                              className="absolute left-0 inset-y-0 w-2.5 cursor-ew-resize rounded-l-lg opacity-0 group-hover:opacity-100 bg-black/20 hover:bg-black/30 transition-opacity"
                              aria-label="Resize start date"
                            />
                            {/* Right resize handle */}
                            <span
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                beginDrag(task, "resize-end", e.clientX);
                              }}
                              className="absolute right-0 inset-y-0 w-2.5 cursor-ew-resize rounded-r-lg opacity-0 group-hover:opacity-100 bg-black/20 hover:bg-black/30 transition-opacity"
                              aria-label="Resize end date"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart Footer Helper */}
      <div className="flex flex-wrap items-center justify-between border-t border-hairline bg-surface-soft/40 px-5 py-3 text-xs text-muted gap-2">
        <div className="flex items-center gap-2">
          {criticalSet.size > 0 && (
            <span className="inline-flex items-center gap-1.5 text-error font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              Critical Path activities have 0 float. Any delay will push out total project completion.
            </span>
          )}
        </div>
        {canEdit && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
            <MoveHorizontal className="h-3.5 w-3.5 text-muted" /> Drag activity body to shift dates &middot; drag edges to adjust duration
          </span>
        )}
      </div>

      {depWarning && (
        <div className="border-t border-warning/30 bg-warning/10 px-5 py-2.5 text-xs font-medium text-warning flex items-center gap-2" role="status">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{depWarning}</span>
        </div>
      )}

      {error && (
        <div className="border-t border-error/30 bg-error/10 px-5 py-2.5">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </div>
  );
}
