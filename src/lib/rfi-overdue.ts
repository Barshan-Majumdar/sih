import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";

/**
 * Flags tasks linked to overdue RFIs. Callers must authorize project access
 * before invoking this internal helper.
 */
export async function syncOverdueRfiFlags(projectId: string): Promise<void> {
  const overdue = await prisma.rFI.findMany({
    where: { projectId, status: "OPEN", dueDate: { lt: new Date() }, taskId: { not: null } },
    include: { task: true, raisedBy: { select: { userId: true } } },
  });

  for (const rfi of overdue) {
    if (!rfi.task || rfi.task.projectId !== projectId || rfi.task.isRoadblock) continue;

    await prisma.task.update({
      where: { id: rfi.task.id },
      data: {
        isRoadblock: true,
        roadblockStatus: "OPEN",
        roadblockNote: `Auto-flagged: RFI "${rfi.question}" is overdue`,
        roadblockType: "OTHER",
        roadblockRaisedBy: rfi.raisedBy.userId,
        roadblockDueDate: rfi.dueDate,
      },
    });
    await logActivity({
      projectId,
      taskId: rfi.task.id,
      taskName: rfi.task.name,
      userId: rfi.raisedBy.userId,
      action: "roadblock_auto_flagged",
      detail: `Auto-flagged "${rfi.task.name}" as a roadblock - linked RFI is overdue`,
      entityType: "TASK",
      entityId: rfi.task.id,
      source: "SYSTEM",
      changes: {
        isRoadblock: { before: false, after: true },
        roadblockStatus: { before: null, after: "OPEN" },
      },
    });
  }
}
