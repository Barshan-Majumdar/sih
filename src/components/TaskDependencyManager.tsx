"use client";

import { useState, useTransition } from "react";
import { addDependency, removeDependency } from "@/app/actions/tasks";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { ArrowRight, Link2, Plus, X, GitCommit } from "lucide-react";

export type DependencyTask = { id: string; name: string };
export type DependencyEdgeRow = { id: string; predecessorId: string; successorId: string };

export function TaskDependencyManager({
  projectId,
  tasks,
  dependencies,
  canManage,
}: {
  projectId: string;
  tasks: DependencyTask[];
  dependencies: DependencyEdgeRow[];
  canManage: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [selectedPredecessor, setSelectedPredecessor] = useState("");

  const taskById = new Map(tasks.map((t) => [t.id, t]));

  function handleAdd(successorId: string) {
    if (!selectedPredecessor) return;
    setError(null);
    startTransition(async () => {
      const result = await addDependency({ projectId, predecessorId: selectedPredecessor, successorId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setAddingFor(null);
      setSelectedPredecessor("");
    });
  }

  function handleRemove(dependencyId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeDependency({ projectId, dependencyId });
      if (!result.success) setError(result.error);
    });
  }

  if (tasks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-hairline bg-surface-card p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink">Schedule Dependencies & Predecessors</h3>
            <p className="text-xs text-muted">
              Define finish-to-start (FS) logic. Tasks with zero total float form the critical path.
            </p>
          </div>
        </div>
        <span className="text-xs font-mono text-muted tabular-nums">
          {dependencies.length} {dependencies.length === 1 ? "link" : "links"} defined
        </span>
      </div>

      <div className="divide-y divide-hairline-soft">
        {tasks.map((task) => {
          const predecessorEdges = dependencies.filter((d) => d.successorId === task.id);
          const eligiblePredecessors = tasks.filter(
            (t) => t.id !== task.id && !predecessorEdges.some((e) => e.predecessorId === t.id)
          );

          return (
            <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-surface-soft/40 px-2 -mx-2 rounded-xl">
              <div className="flex items-center gap-2 min-w-[200px] max-w-sm">
                <GitCommit className="h-4 w-4 text-muted shrink-0" />
                <span className="font-semibold text-sm text-ink truncate" title={task.name}>
                  {task.name}
                </span>
              </div>

              <div className="flex flex-1 flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted shrink-0">
                  <ArrowRight className="h-3 w-3" /> starts after:
                </span>

                {predecessorEdges.length === 0 && addingFor !== task.id && (
                  <span className="text-xs text-muted-soft italic">No predecessor (starts immediately)</span>
                )}

                {predecessorEdges.map((edge) => (
                  <span
                    key={edge.id}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface-soft px-3 py-1 text-xs font-medium text-ink shadow-sm transition-all hover:border-brand-accent/30"
                  >
                    <span className="truncate max-w-[160px]">
                      {taskById.get(edge.predecessorId)?.name ?? "Unknown task"}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleRemove(edge.id)}
                        disabled={pending}
                        className="text-muted hover:text-error transition-colors ml-0.5"
                        aria-label={`Remove predecessor ${taskById.get(edge.predecessorId)?.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}

                {canManage && addingFor === task.id ? (
                  <div className="inline-flex items-center gap-1.5">
                    <select
                      aria-label={`Predecessor for ${task.name}`}
                      value={selectedPredecessor}
                      onChange={(e) => setSelectedPredecessor(e.target.value)}
                      className="h-8 rounded-lg border border-hairline bg-canvas px-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
                    >
                      <option value="">Choose predecessor task…</option>
                      {eligiblePredecessors.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="primary"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => handleAdd(task.id)}
                      disabled={pending || !selectedPredecessor}
                    >
                      Link
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        setAddingFor(null);
                        setSelectedPredecessor("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  canManage &&
                  eligiblePredecessors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddingFor(task.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-hairline px-2.5 py-1 text-xs font-medium text-muted hover:text-ink hover:border-muted-soft hover:bg-surface-soft transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add predecessor</span>
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <ErrorText className="mt-4">{error}</ErrorText>}
    </div>
  );
}
