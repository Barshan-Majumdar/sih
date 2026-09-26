"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, Plus, Calendar, UserCheck } from "lucide-react";
import { addPullPlanTask, reorderPullPlanTasks } from "@/app/actions/pull-planning";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { formatDate } from "@/lib/utils";

export type PullPlanTaskRow = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  assignedTo: { user: { name: string } } | null;
};

export function PullPlanningBoard({
  projectId,
  initialTasks,
  canSequence,
}: {
  projectId: string;
  initialTasks: PullPlanTaskRow[];
  canSequence: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= tasks.length) return;
    const next = [...tasks];
    [next[index], next[target]] = [next[target], next[index]];
    setTasks(next);
    setError(null);
    startTransition(async () => {
      const result = await reorderPullPlanTasks({ projectId, orderedTaskIds: next.map((t) => t.id) });
      if (!result.success) {
        setError(result.error);
        setTasks(tasks); // revert on failure
      }
    });
  }

  return (
    <div className="space-y-6">
      <AddPullPlanTaskForm projectId={projectId} onAdded={() => router.refresh()} />

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-surface-soft/40 px-6 py-12 text-center">
          <p className="text-sm font-semibold tracking-tight text-ink">The pull plan is ready for its first task</p>
          <p className="mt-1 text-xs text-muted">Trade partners can add their own work using the form above.</p>
        </div>
      ) : (
        <ol className="space-y-2.5">
          {tasks.map((task, index) => (
            <li
              key={task.id}
              className="group flex items-center gap-3.5 rounded-xl border border-hairline bg-canvas px-4 py-3.5 shadow-card hover:shadow-card-hover transition-all"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface-soft text-xs font-bold font-mono text-muted">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold tracking-tight text-ink truncate">{task.name}</p>
                <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1 font-medium text-ink/80">
                    <UserCheck className="w-3.5 h-3.5 text-muted" />
                    {task.assignedTo?.user.name ?? "Unassigned"}
                  </span>
                  <span className="text-muted/40">·</span>
                  <span className="inline-flex items-center gap-1 font-mono text-muted">
                    <Calendar className="w-3.5 h-3.5 text-muted" />
                    {formatDate(task.startDate)} – {formatDate(task.endDate)}
                  </span>
                </div>
              </div>
              {canSequence && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={pending || index === 0}
                    className="btn-interactive flex h-7 w-7 items-center justify-center rounded-lg border border-hairline bg-surface-soft text-muted hover:text-ink hover:bg-canvas disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs"
                    aria-label="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={pending || index === tasks.length - 1}
                    className="btn-interactive flex h-7 w-7 items-center justify-center rounded-lg border border-hairline bg-surface-soft text-muted hover:text-ink hover:bg-canvas disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-2xs"
                    aria-label="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function AddPullPlanTaskForm({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await addPullPlanTask({ projectId, name, startDate, endDate });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onAdded();
    setName("");
    setStartDate("");
    setEndDate("");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-hairline bg-surface-soft/80 p-5 shadow-card">
      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Team input</p>
        <h3 className="text-sm font-semibold tracking-tight text-ink mt-0.5">Add your task to the board</h3>
        <p className="text-xs text-muted mt-0.5">
          Any team member can add a task here — it&apos;ll be assigned to you. The session lead sequences the work below.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Task name"
          className="h-9 flex-1 min-w-[200px] rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-9 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all font-mono"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-9 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all font-mono"
        />
        <Button type="submit" variant="primary" disabled={loading || !name.trim() || !startDate || !endDate} className="h-9 text-xs font-semibold gap-1.5 shadow-2xs">
          <Plus className="w-3.5 h-3.5" />
          {loading ? "Adding…" : "Add to board"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
