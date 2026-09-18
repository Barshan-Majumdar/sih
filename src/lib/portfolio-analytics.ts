/**
 * Average day-variance between a project's most recent baseline snapshots and
 * the tasks' current dates. Positive = behind schedule (slipping), negative =
 * ahead. Returns null if the project has no baseline to compare against, or
 * if all snapshotted tasks have since been deleted.
 */
export function computeProjectVariance(
  snapshots: { taskId: string; endDate: Date }[],
  currentEndDateByTaskId: Map<string, Date>
): number | null {
  const diffs: number[] = [];
  for (const s of snapshots) {
    const current = currentEndDateByTaskId.get(s.taskId);
    if (!current) continue;
    diffs.push(Math.round((current.getTime() - s.endDate.getTime()) / 86_400_000));
  }
  if (diffs.length === 0) return null;
  return Math.round(diffs.reduce((sum, d) => sum + d, 0) / diffs.length);
}

/** Maps a day-variance into a 0-100 "on schedule" score. 0 slip = 100, decays as slip grows. */
function varianceToScore(varianceDays: number): number {
  if (varianceDays <= 0) return 100;
  return Math.max(0, 100 - varianceDays * 5);
}

/** Maps an open-roadblock count into a 0-100 score. 0 roadblocks = 100, decays as count grows. */
function roadblocksToScore(openRoadblocks: number): number {
  return Math.max(0, 100 - openRoadblocks * 15);
}

export type HealthScoreInputs = {
  ppc: number | null; // 0-100, most recent weekly PPC
  prr: number | null; // 0-100, overall commitment reliability
  varianceDays: number | null; // from computeProjectVariance
  openRoadblocks: number;
};

/**
 * Composite "Outbuild Score" equivalent: a simple weighted blend of PPC, PRR,
 * schedule variance, and open roadblocks. Components with no data yet (e.g. a
 * brand-new project with no commitments) are excluded and the remaining
 * weights are renormalized, rather than penalizing projects for missing data.
 */
export function computeHealthScore(inputs: HealthScoreInputs): number | null {
  const components: { value: number; weight: number }[] = [];
  if (inputs.ppc !== null) components.push({ value: inputs.ppc, weight: 0.35 });
  if (inputs.prr !== null) components.push({ value: inputs.prr, weight: 0.3 });
  if (inputs.varianceDays !== null) components.push({ value: varianceToScore(inputs.varianceDays), weight: 0.2 });
  components.push({ value: roadblocksToScore(inputs.openRoadblocks), weight: 0.15 });

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return null;

  const weightedSum = components.reduce((sum, c) => sum + c.value * c.weight, 0);
  return Math.round(weightedSum / totalWeight);
}
