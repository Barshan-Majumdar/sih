"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateTaskStatus, deleteTask } from "@/app/actions/tasks";
import { canManageSchedule, canResolveRoadblocks } from "@/lib/permissions";
import { StatusBadge } from "@/components/StatusBadge";
import { RoadblockDialog } from "@/components/RoadblockDialog";
import { EditTaskForm } from "@/components/EditTaskForm";
import { ErrorText } from "@/components/ui/ErrorText";
import { formatDate, daysBetween, TASK_STATUS_LABELS } from "@/lib/utils";
import type { TaskStatus, RoadblockStatus, ProjectRole } from "@prisma/client";

export type TaskRow = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: TaskStatus;
  progress: number;
  isRoadblock: boolean;
  roadblockNote: string | null;
  roadblockStatus: RoadblockStatus | null;
  assignedTo: { id: string; userId: string; user: { name: string } } | null;
};

export type MemberOption = { id: string; userId: string; name: string; role: ProjectRole };

const STATUS_OPTIONS: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DONE", "DELAYED"];

/** Small colored dot mirroring the status select, Outbuild-style. */
const STATUS_DOT: Record<TaskStatus, string> = {
  NOT_STARTED: "bg-surface-strong",
  IN_PROGRESS: "bg-brand-accent",
  DONE: "bg-success",
  DELAYED: "bg-error",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function TaskTable({
  tasks,
  members,
  currentUserId,
  role,
  projectId,
}: {
  tasks: TaskRow[];
  members: MemberOption[];
  currentUserId: string;
  role: ProjectRole;
  projectId: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManage = canManageSchedule(role);
  const canResolve = canResolveRoadblocks(role);
  const colSpan = canManage ? 10 : 9;

  if (tasks.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-hairline bg-canvas px-6 py-14 text-center">
        <p className="app-empty-title">{canManage ? "Build the first schedule" : "No schedule activities yet"}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          {canManage
            ? "Add the first activity, assign ownership, and give the project team one shared plan to work from."
            : "The project schedule will appear here once activities are added."}
        </p>
      </div>
    );
  }

  return (
    <div className="app-table-wrap overflow-x-auto">
      <table className="w-full min-w-[1050px] text-sm">
        <thead>
          <tr className="border-b border-hairline bg-surface-soft text-left">
            <th className="app-table-heading w-10 border-r border-hairline-soft py-2.5 pl-4 pr-3 text-center">#</th>
            <th className="app-table-heading px-3 py-2.5">Task</th>
            <th className="app-table-heading px-3 py-2.5">Responsible</th>
            <th className="app-table-heading whitespace-nowrap px-3 py-2.5">Start</th>
            <th className="app-table-heading whitespace-nowrap px-3 py-2.5">End</th>
            <th className="app-table-heading whitespace-nowrap px-3 py-2.5 text-right">Duration</th>
            <th className="app-table-heading px-3 py-2.5">Progress</th>
            <th className="app-table-heading px-3 py-2.5">Status</th>
            <th className="app-table-heading px-3 py-2.5">Roadblock</th>
            {canManage && <th className="app-table-heading py-2.5 pl-3 pr-4 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, index) => {
            const isAssignedTrade = task.assignedTo?.userId === currentUserId;
            const canEdit = canManage || isAssignedTrade;
            const canResolveThis = canResolve || isAssignedTrade;
            if (editingId === task.id) {
              return (
                <tr key={task.id} className="border-b border-hairline-soft last:border-b-0">
                  <td colSpan={colSpan} className="py-3 px-4">
                    <EditTaskForm
                      task={task}
                      members={members}
                      onDone={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              );
            }
            return (
              <TaskRowView
                key={task.id}
                task={task}
                index={index}
                projectId={projectId}
                canEdit={canEdit}
                canResolve={canResolveThis}
                canManage={canManage}
                colSpan={colSpan}
                onEdit={() => setEditingId(task.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaskRowView({
  task,
  index,
  projectId,
  canEdit,
  canResolve,
  canManage,
  colSpan,
  onEdit,
}: {
  task: TaskRow;
  index: number;
  projectId: string;
  canEdit: boolean;
  canResolve: boolean;
  canManage: boolean;
  colSpan: number;
  onEdit: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const duration = Math.max(daysBetween(task.startDate, task.endDate), 1);

  function handleStatusChange(status: TaskStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateTaskStatus({ taskId: task.id, status });
      if (!result.success) setError(result.error);
    });
  }

  function handleDelete() {
    setError(null);
    setDeleting(true);
    startTransition(async () => {
      const result = await deleteTask({ taskId: task.id });
      setDeleting(false);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <>
      <tr className="app-table-row border-b border-hairline-soft align-middle last:border-b-0">
        <td className="py-2.5 pl-4 pr-3 text-center text-xs text-muted-soft font-mono border-r border-hairline-soft">
          {index + 1}
        </td>
        <td className="py-2.5 px-3 font-medium text-ink">
          <Link href={`/projects/${projectId}/tasks/${task.id}`} className="underline-offset-4 hover:underline">
            {task.name}
          </Link>
        </td>
        <td className="py-2.5 px-3">
          {task.assignedTo ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-strong text-[10px] font-semibold text-body"
                aria-hidden
              >
                {initials(task.assignedTo.user.name)}
              </span>
              <span className="text-body">{task.assignedTo.user.name}</span>
            </span>
          ) : (
            <span className="text-muted-soft">Unassigned</span>
          )}
        </td>
        <td className="py-2.5 px-3 text-muted whitespace-nowrap">{formatDate(task.startDate)}</td>
        <td className="py-2.5 px-3 text-muted whitespace-nowrap">{formatDate(task.endDate)}</td>
        <td className="py-2.5 px-3 text-muted whitespace-nowrap text-right font-mono text-xs">{duration} d</td>
        <td className="py-2.5 px-3">
          <div className="flex w-24 items-center gap-2" aria-label={`${task.progress}% complete`}>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-strong">
              <span
                className="block h-full rounded-full bg-success"
                style={{ width: `${task.progress}%` }}
              />
            </span>
            <span className="w-8 text-right font-mono text-[11px] text-muted">{task.progress}%</span>
          </div>
        </td>
        <td className="py-2.5 px-3">
          {canEdit ? (
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[task.status]}`} aria-hidden />
              <select
                aria-label={`Status for ${task.name}`}
                value={task.status}
                disabled={pending}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className="h-7 rounded-md border border-hairline bg-canvas px-1.5 text-xs focus:outline-none focus:border-ink disabled:opacity-50"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </span>
          ) : (
            <StatusBadge status={task.status} />
          )}
        </td>
        <td className="py-2.5 px-3">
          <RoadblockDialog
            taskId={task.id}
            isRoadblock={task.isRoadblock}
            roadblockNote={task.roadblockNote}
            roadblockStatus={task.roadblockStatus}
            canResolve={canResolve}
          />
        </td>
        {canManage && (
          <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={onEdit}
                disabled={pending}
                title="Edit task"
                aria-label={`Edit ${task.name}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:text-ink hover:bg-surface-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                title="Delete task"
                aria-label={`Delete ${task.name}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending && deleting ? (
                  <span className="text-[10px]">…</span>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 6h18" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                )}
              </button>
            </span>
          </td>
        )}
      </tr>
      {error && (
        <tr className="border-b border-hairline-soft">
          <td colSpan={colSpan} className="pb-3 px-4">
            <ErrorText>{error}</ErrorText>
          </td>
        </tr>
      )}
    </>
  );
}
