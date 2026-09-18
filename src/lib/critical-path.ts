export type TaskForCriticalPath = { id: string; startDate: Date; endDate: Date };
export type DependencyEdge = { predecessorId: string; successorId: string };

/**
 * Standard forward/backward-pass Critical Path Method (CPM) over a task dependency
 * DAG. Task "duration" is derived from its own start/end dates. Returns the set of
 * task ids with zero float (i.e. any delay pushes out the overall project length).
 *
 * Gracefully returns an empty set if the graph contains a cycle (shouldn't happen —
 * addDependency() rejects cycles — but this keeps rendering safe either way).
 */
export function computeCriticalPath(tasks: TaskForCriticalPath[], dependencies: DependencyEdge[]): Set<string> {
  if (tasks.length === 0) return new Set();

  const durationById = new Map<string, number>();
  for (const t of tasks) {
    const days = Math.max(Math.round((t.endDate.getTime() - t.startDate.getTime()) / 86_400_000), 0);
    durationById.set(t.id, days);
  }

  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const t of tasks) {
    predecessors.set(t.id, []);
    successors.set(t.id, []);
  }
  for (const dep of dependencies) {
    if (!durationById.has(dep.predecessorId) || !durationById.has(dep.successorId)) continue;
    predecessors.get(dep.successorId)?.push(dep.predecessorId);
    successors.get(dep.predecessorId)?.push(dep.successorId);
  }

  // Topological order via Kahn's algorithm.
  const inDegree = new Map<string, number>();
  for (const t of tasks) inDegree.set(t.id, predecessors.get(t.id)!.length);
  const queue: string[] = tasks.filter((t) => inDegree.get(t.id) === 0).map((t) => t.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const succ of successors.get(id) ?? []) {
      const next = (inDegree.get(succ) ?? 0) - 1;
      inDegree.set(succ, next);
      if (next === 0) queue.push(succ);
    }
  }
  if (order.length < tasks.length) return new Set(); // cycle detected — bail out safely

  // Forward pass: earliest start/finish.
  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();
  for (const id of order) {
    const preds = predecessors.get(id) ?? [];
    const es = preds.length === 0 ? 0 : Math.max(...preds.map((p) => earliestFinish.get(p)!));
    earliestStart.set(id, es);
    earliestFinish.set(id, es + durationById.get(id)!);
  }

  const projectDuration = Math.max(0, ...tasks.map((t) => earliestFinish.get(t.id)!));

  // Backward pass: latest start/finish.
  const latestStart = new Map<string, number>();
  const latestFinish = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const succs = successors.get(id) ?? [];
    const lf = succs.length === 0 ? projectDuration : Math.min(...succs.map((s) => latestStart.get(s)!));
    latestFinish.set(id, lf);
    latestStart.set(id, lf - durationById.get(id)!);
  }

  const critical = new Set<string>();
  for (const t of tasks) {
    const float = latestStart.get(t.id)! - earliestStart.get(t.id)!;
    if (float === 0) critical.add(t.id);
  }
  return critical;
}

/**
 * Returns true if adding predecessorId -> successorId would create a cycle,
 * given the existing set of dependency edges (i.e. successorId can already
 * reach predecessorId by following existing successor links).
 */
export function wouldCreateCycle(
  existing: DependencyEdge[],
  predecessorId: string,
  successorId: string
): boolean {
  if (predecessorId === successorId) return true;

  const successorsOf = new Map<string, string[]>();
  for (const dep of existing) {
    if (!successorsOf.has(dep.predecessorId)) successorsOf.set(dep.predecessorId, []);
    successorsOf.get(dep.predecessorId)!.push(dep.successorId);
  }

  const visited = new Set<string>();
  const stack = [successorId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === predecessorId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of successorsOf.get(current) ?? []) stack.push(next);
  }
  return false;
}
