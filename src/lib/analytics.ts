import type { CommitmentStatus, TaskStatus } from "@prisma/client";

/** Weekly Percent Plan Complete: completed / total commitments made for that week. */
export function computePpcTrend(
  commitments: { weekStartDate: Date; status: CommitmentStatus; removedAt?: Date | null }[]
): { weekStart: Date; ppc: number; total: number; completed: number }[] {
  const byWeek = new Map<string, { weekStart: Date; total: number; completed: number }>();

  for (const c of commitments) {
    if (c.removedAt) continue;
    const key = c.weekStartDate.toISOString();
    const bucket = byWeek.get(key) ?? { weekStart: c.weekStartDate, total: 0, completed: 0 };
    bucket.total += 1;
    if (c.status === "COMPLETED") bucket.completed += 1;
    byWeek.set(key, bucket);
  }

  return [...byWeek.values()]
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    .map((b) => ({ ...b, ppc: b.total === 0 ? 0 : Math.round((b.completed / b.total) * 100) }));
}

/**
 * Promise Reliability Rate: per trade/member, what share of their commitments
 * were completed. Complements the week-over-week PPC trend with a per-trade
 * breakdown — useful for spotting which trades are behind on commitments.
 */
export function computePrrByMember(
  commitments: {
    committedById: string;
    committedByName: string;
    status: CommitmentStatus;
    removedAt?: Date | null;
  }[]
): { memberId: string; name: string; prr: number; total: number; completed: number }[] {
  const byMember = new Map<string, { name: string; total: number; completed: number }>();

  for (const c of commitments) {
    if (c.removedAt) continue;
    const bucket = byMember.get(c.committedById) ?? { name: c.committedByName, total: 0, completed: 0 };
    bucket.total += 1;
    if (c.status === "COMPLETED") bucket.completed += 1;
    byMember.set(c.committedById, bucket);
  }

  return [...byMember.entries()]
    .map(([memberId, b]) => ({
      memberId,
      name: b.name,
      total: b.total,
      completed: b.completed,
      prr: b.total === 0 ? 0 : Math.round((b.completed / b.total) * 100),
    }))
    .sort((a, b) => b.total - a.total);
}

export type SCurvePoint = { date: Date; cumulative: number };

/**
 * Planned vs. actual cumulative task completion over time, bucketed weekly.
 * "Planned" cumulates by each task's planned end date; "actual" cumulates by
 * the date a task's status last changed to DONE (approximated with
 * `updatedAt`, since we don't track a separate completion timestamp).
 */
export function computeSCurve(
  tasks: { endDate: Date; status: TaskStatus; updatedAt: Date }[],
  rangeStart: Date,
  rangeEnd: Date
): { planned: SCurvePoint[]; actual: SCurvePoint[] } {
  const buckets: Date[] = [];
  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    buckets.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  if (buckets.length === 0 || buckets[buckets.length - 1].getTime() !== end.getTime()) {
    buckets.push(end);
  }

  const planned = buckets.map((date) => ({
    date,
    cumulative: tasks.filter((t) => t.endDate <= date).length,
  }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // The actual line stops at today — projecting it further would misleadingly
  // imply no future progress rather than "not yet known".
  const actual = buckets
    .filter((date) => date <= today)
    .map((date) => ({
      date,
      cumulative: tasks.filter((t) => t.status === "DONE" && t.updatedAt <= date).length,
    }));

  return { planned, actual };
}
