/**
 * Authoritative Plan vs. Actual Progress Calculation & Duration-Weighted Rollup Engine.
 * Replaces unweighted task counting with civil engineering progress mathematics.
 */

export type DelayStatus = "AHEAD" | "ON_TRACK" | "MINOR_DELAY" | "CRITICAL_DELAY" | "COMPLETED";

export interface ProgressCalculationResult {
  plannedProgress: number;
  actualProgress: number;
  variance: number;
  delayStatus: DelayStatus;
  plannedDurationDays: number;
}

export function clamp(val: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, val));
}

export function daysBetween(start: Date | string, end: Date | string): number {
  const msPerDay = 86_400_000;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / msPerDay));
}

/**
 * Calculates linear planned progress based on elapsed calendar time.
 */
export function calculateLinearPlannedProgress(
  startDate: Date | string,
  endDate: Date | string,
  targetDate: Date = new Date()
): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const target = targetDate.getTime();

  if (target <= start) return 0;
  if (target >= end) return 100;
  if (end <= start) return 100;

  const progress = ((target - start) / (end - start)) * 100;
  return clamp(Math.round(progress));
}

/**
 * Classifies variance into authoritative project health categories.
 */
export function classifyDelay(variance: number, actualProgress: number): DelayStatus {
  if (actualProgress >= 100) return "COMPLETED";
  if (variance >= 5) return "AHEAD";
  if (variance >= -5) return "ON_TRACK";
  if (variance >= -10) return "MINOR_DELAY";
  return "CRITICAL_DELAY";
}

/**
 * Calculates single-task progress and delay metrics.
 */
export function evaluateTaskProgress(
  task: {
    startDate: Date | string;
    endDate: Date | string;
    progress: number;
  },
  targetDate: Date = new Date()
): ProgressCalculationResult {
  const plannedDurationDays = daysBetween(task.startDate, task.endDate);
  const plannedProgress = calculateLinearPlannedProgress(task.startDate, task.endDate, targetDate);
  const actualProgress = clamp(task.progress);
  const variance = actualProgress - plannedProgress;
  const delayStatus = classifyDelay(variance, actualProgress);

  return {
    plannedProgress,
    actualProgress,
    variance,
    delayStatus,
    plannedDurationDays,
  };
}

export interface WbsChildTask {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  progress: number;
}

/**
 * Computes duration-weighted hierarchical progress rollup across parent-child tasks.
 * Ensures a 1-day task does not carry the same weight as a 90-day task.
 */
export function calculateDurationWeightedRollup(
  childTasks: WbsChildTask[],
  targetDate: Date = new Date()
): ProgressCalculationResult {
  if (childTasks.length === 0) {
    return {
      plannedProgress: 0,
      actualProgress: 0,
      variance: 0,
      delayStatus: "ON_TRACK",
      plannedDurationDays: 0,
    };
  }

  let totalWeight = 0;
  let weightedActualSum = 0;
  let weightedPlannedSum = 0;

  for (const child of childTasks) {
    const weight = daysBetween(child.startDate, child.endDate);
    const planned = calculateLinearPlannedProgress(child.startDate, child.endDate, targetDate);
    const actual = clamp(child.progress);

    totalWeight += weight;
    weightedActualSum += actual * weight;
    weightedPlannedSum += planned * weight;
  }

  const actualProgress = totalWeight > 0 ? clamp(Math.round(weightedActualSum / totalWeight)) : 0;
  const plannedProgress = totalWeight > 0 ? clamp(Math.round(weightedPlannedSum / totalWeight)) : 0;
  const variance = actualProgress - plannedProgress;
  const delayStatus = classifyDelay(variance, actualProgress);

  return {
    plannedProgress,
    actualProgress,
    variance,
    delayStatus,
    plannedDurationDays: totalWeight,
  };
}
