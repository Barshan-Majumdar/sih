"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
        <div className="rounded-md border border-dashed border-hairline bg-canvas px-6 py-10 text-center">
          <p className="app-empty-title">The pull plan is ready for its first task</p>
          <p className="mt-2 text-sm text-muted">Trade partners can add their own work using the form above.</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {tasks.map((task, index) => (
            <li
              key={task.id}
              className="group flex items-center gap-3 rounded-md border border-hairline bg-canvas px-4 py-3 shadow-[0_1px_2px_rgba(17,17,17,0.03)] transition-colors hover:border-muted-soft"
            >
              <span className="text-xs font-mono text-muted-soft w-6">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{task.name}</p>
                <p className="text-xs text-muted">
                  {task.assignedTo?.user.name ?? "Unassigned"} · {formatDate(task.startDate)} –{" "}
                  {formatDate(task.endDate)}
                </p>
              </div>
              {canSequence && (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={pending || index === 0}
                    className="text-xs text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={pending || index === tasks.length - 1}
                    className="text-xs text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                    aria-label="Move down"
                  >
                    ▼
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
    <form onSubmit={handleSubmit} className="rounded-md border border-hairline bg-surface-soft p-4">
      <p className="app-kicker mb-1">Team input</p>
      <h3 className="app-card-title mb-1">Add your task to the board</h3>
      <p className="text-xs text-muted-soft mb-3">
        Any team member can add a task here — it&apos;ll be assigned to you. The session lead sequences the work below.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Task name"
          className="h-10 flex-1 min-w-[200px] rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <Button type="submit" variant="secondary" disabled={loading || !name.trim() || !startDate || !endDate}>
          {loading ? "Adding…" : "Add to board"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
