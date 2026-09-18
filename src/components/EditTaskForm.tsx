"use client";

import { useState, FormEvent } from "react";
import { updateTask } from "@/app/actions/tasks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorText } from "@/components/ui/ErrorText";
import { TASK_STATUS_LABELS } from "@/lib/utils";
import type { TaskStatus } from "@prisma/client";
import type { TaskRow, MemberOption } from "@/components/TaskTable";

const STATUS_OPTIONS: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "DONE", "DELAYED"];

function toDateInput(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function EditTaskForm({
  task,
  members,
  onDone,
}: {
  task: TaskRow;
  members: MemberOption[];
  onDone: () => void;
}) {
  const [name, setName] = useState(task.name);
  const [assignedToId, setAssignedToId] = useState(task.assignedTo?.id ?? "");
  const [startDate, setStartDate] = useState(toDateInput(task.startDate));
  const [endDate, setEndDate] = useState(toDateInput(task.endDate));
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [progress, setProgress] = useState<number>(task.progress);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleStatusChange(nextStatus: TaskStatus) {
    setStatus(nextStatus);
    if (nextStatus === "DONE") {
      setProgress(100);
    } else if (nextStatus === "NOT_STARTED") {
      setProgress(0);
    } else if (nextStatus === "IN_PROGRESS") {
      if (progress >= 100) setProgress(50);
      else if (progress <= 0) setProgress(10);
    } else if (nextStatus === "DELAYED") {
      if (progress >= 100) setProgress(50);
    }
  }

  function handleProgressChange(valStr: string) {
    const parsed = parseInt(valStr, 10);
    const val = isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed));
    setProgress(val);
    if (val === 100) {
      setStatus("DONE");
    } else if (val === 0) {
      setStatus("NOT_STARTED");
    } else if (status === "DONE" || status === "NOT_STARTED") {
      setStatus("IN_PROGRESS");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await updateTask({
      taskId: task.id,
      name,
      assignedToId: assignedToId || null,
      startDate,
      endDate,
      status,
      progress,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 bg-surface-soft p-4 rounded-lg">
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-muted mb-1">Task Name</label>
        <Input aria-label="Task name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">Assignee</label>
        <select
          aria-label="Assignee"
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">Start Date</label>
        <Input aria-label="Task start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-36" />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">End Date</label>
        <Input aria-label="Task end date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-36" />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">Status</label>
        <select
          aria-label="Task status"
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">Progress %</label>
        <div className="flex items-center gap-1">
          <Input
            aria-label="Progress percentage"
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => handleProgressChange(e.target.value)}
            className="w-20 font-mono text-right"
          />
          <span className="text-xs text-muted font-mono">%</span>
        </div>
      </div>
      <Button type="submit" disabled={loading} className="h-10">
        {loading ? "Saving…" : "Save"}
      </Button>
      <Button type="button" variant="secondary" className="h-10" onClick={onDone}>
        Cancel
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
