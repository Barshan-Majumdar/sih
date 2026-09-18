import { prisma } from "@/lib/prisma";
import { percentComplete } from "@/lib/utils";
import { computePpcTrend } from "@/lib/analytics";
import { computeProjectVariance, computeHealthScore } from "@/lib/portfolio-analytics";

/**
 * Aggregates the portfolio-level metrics for a single project: completion,
 * PPC, PRR, schedule variance (vs. its latest baseline, if any), and a
 * composite health score. Shared by the Executive Dashboard and Timeline.
 */
export async function loadProjectSummary(projectId: string) {
  const [totalTasks, doneTasks, commitments, latestBaseline, openRoadblocks] = await Promise.all([
    prisma.task.count({ where: { projectId } }),
    prisma.task.count({ where: { projectId, status: "DONE" } }),
    prisma.weeklyCommitment.findMany({
      where: { removedAt: null, task: { projectId } },
      select: { weekStartDate: true, status: true },
      orderBy: { weekStartDate: "asc" },
    }),
    prisma.baseline.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { snapshots: true },
    }),
    prisma.task.count({ where: { projectId, isRoadblock: true, roadblockStatus: "OPEN" } }),
  ]);

  const ppcTrend = computePpcTrend(commitments);
  const latestPpc = ppcTrend.length > 0 ? ppcTrend[ppcTrend.length - 1].ppc : null;

  const totalCommitments = commitments.length;
  const completedCommitments = commitments.filter((c) => c.status === "COMPLETED").length;
  const prr = totalCommitments > 0 ? Math.round((completedCommitments / totalCommitments) * 100) : null;

  let variance: number | null = null;
  if (latestBaseline) {
    const currentTasks = await prisma.task.findMany({
      where: { id: { in: latestBaseline.snapshots.map((s) => s.taskId) } },
      select: { id: true, endDate: true },
    });
    const currentEndDateByTaskId = new Map(currentTasks.map((t) => [t.id, t.endDate]));
    variance = computeProjectVariance(latestBaseline.snapshots, currentEndDateByTaskId);
  }

  const healthScore = computeHealthScore({ ppc: latestPpc, prr, varianceDays: variance, openRoadblocks });

  return {
    totalTasks,
    percentComplete: percentComplete(totalTasks, doneTasks),
    openRoadblocks,
    ppc: latestPpc,
    prr,
    variance,
    healthScore,
  };
}

export function healthColor(score: number | null): string {
  if (score === null) return "text-muted";
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-ink";
  return "text-error";
}
