import { computeCriticalPath, type DependencyEdge } from "@/lib/critical-path";

export const MS_PER_DAY = 86_400_000;

export type ScheduleImpactTask = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
};

export type ScheduleReflowResult = {
  afterTasks: ScheduleImpactTask[];
  changedTaskIds: string[];
  downstreamTaskIds: string[];
  blockedTaskIds: string[];
  anchorAppliedDays: number;
};

export function shiftTaskByDays<T extends ScheduleImpactTask>(task: T, days: number): T {
  return {
    ...task,
    startDate: new Date(task.startDate.getTime() + days * MS_PER_DAY),
    endDate: new Date(task.endDate.getTime() + days * MS_PER_DAY),
  };
}

function dependencyMaps(tasks: ScheduleImpactTask[], edges: DependencyEdge[]) {
  const ids = new Set(tasks.map((task) => task.id));
  const predecessors = new Map(tasks.map((task) => [task.id, [] as string[]]));
  const successors = new Map(tasks.map((task) => [task.id, [] as string[]]));
  const inDegree = new Map(tasks.map((task) => [task.id, 0]));

  for (const edge of edges) {
    if (!ids.has(edge.predecessorId) || !ids.has(edge.successorId)) continue;
    predecessors.get(edge.successorId)?.push(edge.predecessorId);
    successors.get(edge.predecessorId)?.push(edge.successorId);
    inDegree.set(edge.successorId, (inDegree.get(edge.successorId) ?? 0) + 1);
  }

  const queue = tasks.filter((task) => inDegree.get(task.id) === 0).map((task) => task.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    order.push(id);
    for (const successorId of successors.get(id) ?? []) {
      const next = (inDegree.get(successorId) ?? 0) - 1;
      inDegree.set(successorId, next);
      if (next === 0) queue.push(successorId);
    }
  }

  return { predecessors, successors, order, hasCycle: order.length !== tasks.length };
}

export function projectFinish(tasks: ScheduleImpactTask[]): Date | null {
  if (tasks.length === 0) return null;
  return new Date(Math.max(...tasks.map((task) => task.endDate.getTime())));
}

export function simulateDownstreamReflow(params: {
  tasks: ScheduleImpactTask[];
  edges: DependencyEdge[];
  anchorTaskId: string;
  shiftDays: number;
  lockedTaskIds?: Iterable<string>;
}): ScheduleReflowResult {
  const graph = dependencyMaps(params.tasks, params.edges);
  if (graph.hasCycle) throw new Error("The schedule contains a circular dependency.");

  const beforeById = new Map(params.tasks.map((task) => [task.id, task]));
  const anchor = beforeById.get(params.anchorTaskId);
  if (!anchor) throw new Error("The task to reflow was not found.");

  const reachable = new Set<string>();
  const stack = [...(graph.successors.get(anchor.id) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);
    stack.push(...(graph.successors.get(id) ?? []));
  }

  const locked = new Set(params.lockedTaskIds ?? []);
  const blockedTaskIds: string[] = [];
  let shiftedAnchor = shiftTaskByDays(anchor, params.shiftDays);
  const anchorPredecessorFinishes = (graph.predecessors.get(anchor.id) ?? [])
    .map((predecessorId) => beforeById.get(predecessorId)?.endDate.getTime())
    .filter((value): value is number => value !== undefined);
  if (anchorPredecessorFinishes.length > 0) {
    const earliestStart = Math.max(...anchorPredecessorFinishes);
    if (shiftedAnchor.startDate.getTime() < earliestStart) {
      const correctionDays = Math.ceil(
        (earliestStart - shiftedAnchor.startDate.getTime()) / MS_PER_DAY
      );
      shiftedAnchor = shiftTaskByDays(shiftedAnchor, correctionDays);
    }
  }
  const afterById = new Map(
    params.tasks.map((task) => [
      task.id,
      task.id === anchor.id ? shiftedAnchor : { ...task },
    ])
  );

  if (locked.has(anchor.id)) blockedTaskIds.push(anchor.id);

  for (const taskId of graph.order) {
    if (taskId === anchor.id || !reachable.has(taskId)) continue;
    const task = afterById.get(taskId);
    if (!task) continue;
    const predecessorFinishes = (graph.predecessors.get(taskId) ?? [])
      .map((predecessorId) => afterById.get(predecessorId)?.endDate.getTime())
      .filter((value): value is number => value !== undefined);
    if (predecessorFinishes.length === 0) continue;
    const requiredStart = Math.max(...predecessorFinishes);
    if (task.startDate.getTime() >= requiredStart) continue;
    if (locked.has(taskId)) {
      blockedTaskIds.push(taskId);
      continue;
    }
    const days = Math.ceil((requiredStart - task.startDate.getTime()) / MS_PER_DAY);
    afterById.set(taskId, shiftTaskByDays(task, days));
  }

  const afterTasks = params.tasks.map((task) => afterById.get(task.id) ?? task);
  const changedTaskIds = afterTasks
    .filter((task) => {
      const before = beforeById.get(task.id);
      return (
        before &&
        (before.startDate.getTime() !== task.startDate.getTime() ||
          before.endDate.getTime() !== task.endDate.getTime())
      );
    })
    .map((task) => task.id);

  return {
    afterTasks,
    changedTaskIds,
    downstreamTaskIds: changedTaskIds.filter((taskId) => taskId !== anchor.id),
    blockedTaskIds: [...new Set(blockedTaskIds)],
    anchorAppliedDays: Math.round(
      (shiftedAnchor.startDate.getTime() - anchor.startDate.getTime()) / MS_PER_DAY
    ),
  };
}

export function computeScheduleCriticalTasks(
  tasks: ScheduleImpactTask[],
  edges: DependencyEdge[]
): Set<string> {
  const finish = projectFinish(tasks);
  if (!finish) return new Set();
  const critical = new Set<string>();
  for (const task of tasks) {
    const simulation = simulateDownstreamReflow({
      tasks,
      edges,
      anchorTaskId: task.id,
      shiftDays: 1,
    });
    const delayedFinish = projectFinish(simulation.afterTasks);
    if (delayedFinish && delayedFinish.getTime() > finish.getTime()) critical.add(task.id);
  }
  return critical;
}

export function analyzeScheduleImpact(params: {
  projectStart: Date;
  projectEnd: Date;
  beforeTasks: ScheduleImpactTask[];
  afterTasks: ScheduleImpactTask[];
  beforeEdges: DependencyEdge[];
  afterEdges: DependencyEdge[];
  changedTaskIds: string[];
  changedEdges?: DependencyEdge[];
}): string[] {
  const warnings: string[] = [];
  const changedIds = new Set(params.changedTaskIds);
  const changedEdgeKeys = new Set(
    (params.changedEdges ?? []).map((edge) => `${edge.predecessorId}:${edge.successorId}`)
  );
  const beforeById = new Map(params.beforeTasks.map((task) => [task.id, task]));
  const afterById = new Map(params.afterTasks.map((task) => [task.id, task]));

  const outsideProject = params.afterTasks.filter(
    (task) =>
      changedIds.has(task.id) &&
      (task.startDate < params.projectStart || task.endDate > params.projectEnd)
  );
  if (outsideProject.length > 0) {
    warnings.push(
      `${outsideProject.map((task) => task.name).join(", ")} will extend outside the current project dates.`
    );
  }

  for (const edge of params.afterEdges) {
    const impacted =
      changedIds.has(edge.predecessorId) ||
      changedIds.has(edge.successorId) ||
      changedEdgeKeys.has(`${edge.predecessorId}:${edge.successorId}`);
    if (!impacted) continue;
    const predecessor = afterById.get(edge.predecessorId);
    const successor = afterById.get(edge.successorId);
    if (predecessor && successor && predecessor.endDate > successor.startDate) {
      warnings.push(
        `${successor.name} starts before its predecessor ${predecessor.name} finishes.`
      );
    }
  }

  const beforeCritical = computeCriticalPath(params.beforeTasks, params.beforeEdges);
  const afterCritical = computeCriticalPath(params.afterTasks, params.afterEdges);
  const shiftedCritical = params.afterTasks.filter(
    (task) => changedIds.has(task.id) && afterCritical.has(task.id)
  );
  if (shiftedCritical.length > 0) {
    warnings.push(
      `${shiftedCritical.map((task) => task.name).join(", ")} ${shiftedCritical.length === 1 ? "is" : "are"} on the critical path.`
    );
  }

  const newlyCritical = params.afterTasks.filter(
    (task) => afterCritical.has(task.id) && !beforeCritical.has(task.id) && !changedIds.has(task.id)
  );
  if (newlyCritical.length > 0) {
    warnings.push(
      `${newlyCritical.map((task) => task.name).join(", ")} may become critical after this dependency change.`
    );
  }

  for (const taskId of changedIds) {
    const before = beforeById.get(taskId);
    const after = afterById.get(taskId);
    if (!before || !after) continue;
    if (after.startDate < before.startDate) continue;
    const untouchedSuccessors = params.afterEdges
      .filter((edge) => edge.predecessorId === taskId && !changedIds.has(edge.successorId))
      .map((edge) => afterById.get(edge.successorId)?.name)
      .filter((name): name is string => Boolean(name));
    if (untouchedSuccessors.length > 0) {
      warnings.push(
        `Review downstream dates for ${untouchedSuccessors.join(", ")}; ${after.name} moves without them.`
      );
    }
  }

  return [...new Set(warnings)].slice(0, 8);
}
