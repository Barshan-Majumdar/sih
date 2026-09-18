"use client";

import { useState, useTransition } from "react";
import { addDependency, removeDependency } from "@/app/actions/tasks";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";

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
    <div className="border border-hairline rounded-lg p-5">
      <h3 className="app-card-title mb-1">Dependencies</h3>
      <p className="app-card-description mb-4">
        Mark which tasks must finish before another can start. Tasks with zero slack are highlighted on the chart above.
      </p>
      <div className="space-y-3">
        {tasks.map((task) => {
          const predecessorEdges = dependencies.filter((d) => d.successorId === task.id);
          const eligiblePredecessors = tasks.filter(
            (t) => t.id !== task.id && !predecessorEdges.some((e) => e.predecessorId === t.id)
          );
          return (
            <div key={task.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-ink w-48 shrink-0 truncate">{task.name}</span>
              <span className="text-xs text-muted shrink-0">after:</span>
              {predecessorEdges.length === 0 && addingFor !== task.id && (
                <span className="text-xs text-muted-soft">nothing</span>
              )}
              {predecessorEdges.map((edge) => (
                <span
                  key={edge.id}
                  className="inline-flex items-center gap-1 rounded-pill bg-surface-card px-2.5 py-1 text-xs"
                >
                  {taskById.get(edge.predecessorId)?.name ?? "Unknown task"}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleRemove(edge.id)}
                      disabled={pending}
                      className="text-muted hover:text-error"
                      aria-label="Remove dependency"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {canManage && addingFor === task.id ? (
                <span className="inline-flex items-center gap-1">
                  <select
                    aria-label={`Predecessor for ${task.name}`}
                    value={selectedPredecessor}
                    onChange={(e) => setSelectedPredecessor(e.target.value)}
                    className="h-8 rounded-md border border-hairline bg-canvas px-2 text-xs focus:outline-none focus:border-ink"
                  >
                    <option value="">Select task…</option>
                    {eligiblePredecessors.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="text"
                    className="text-xs"
                    onClick={() => handleAdd(task.id)}
                    disabled={pending || !selectedPredecessor}
                  >
                    Add
                  </Button>
                  <Button
                    variant="text"
                    className="text-xs text-muted"
                    onClick={() => {
                      setAddingFor(null);
                      setSelectedPredecessor("");
                    }}
                  >
                    Cancel
                  </Button>
                </span>
              ) : (
                canManage &&
                eligiblePredecessors.length > 0 && (
                  <Button variant="text" className="text-xs" onClick={() => setAddingFor(task.id)}>
                    + Add
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
