import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { syncOverdueRfiFlags } from "@/lib/rfi-overdue";
import { RoadblockLogTable } from "@/components/RoadblockLogTable";
import { ProjectPageHeader } from "@/components/PageHeader";
import type { RoadblockStatus } from "@prisma/client";
import { privateStoredFileUrl } from "@/lib/storage";

export default async function ProjectRoadblocksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { projectId } = await params;
  const { status } = await searchParams;
  const { project, role, user } = await getProjectPageContext(projectId);

  await syncOverdueRfiFlags(projectId);

  const statusFilter: RoadblockStatus | "ALL" =
    status === "RESOLVED" || status === "ALL" ? (status as RoadblockStatus | "ALL") : "OPEN";

  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      where: {
        projectId,
        isRoadblock: true,
        ...(statusFilter === "ALL" ? {} : { roadblockStatus: statusFilter }),
      },
      include: {
        assignedTo: { select: { userId: true } },
        roadblockAttachment: {
          select: { fileName: true, fileUrl: true, searchableFileUrl: true },
        },
      },
      orderBy: { roadblockDueDate: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const memberNameByUserId = new Map(members.map((m) => [m.userId, m.user.name]));
  const roadblocks = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    roadblockNote: t.roadblockNote,
    roadblockStatus: t.roadblockStatus,
    roadblockType: t.roadblockType,
    roadblockOwnerId: t.roadblockOwnerId,
    roadblockDueDate: t.roadblockDueDate,
    roadblockAttachment: t.roadblockAttachment
      ? {
          fileName: t.roadblockAttachment.fileName,
          fileUrl: privateStoredFileUrl(
            t.roadblockAttachment.searchableFileUrl ?? t.roadblockAttachment.fileUrl
          ),
        }
      : null,
    roadblockPageNumber: t.roadblockPageNumber,
    roadblockCitationExcerpt: t.roadblockCitationExcerpt,
    raisedByName: (t.roadblockRaisedBy && memberNameByUserId.get(t.roadblockRaisedBy)) || "Unknown",
    assignedToUserId: t.assignedTo?.userId ?? null,
  }));

  const memberOptions = members.map((m) => ({ id: m.id, name: m.user.name }));

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Roadblocks & Constraints"
        description="Surface constraints early, assign ownership, and keep unresolved risk visible."
      />

      <div className="mt-6 space-y-4">
        <div className="inline-flex items-center gap-1 rounded-md border border-hairline bg-canvas p-1">
          {(["OPEN", "RESOLVED", "ALL"] as const).map((s) => (
            <Link
              key={s}
              href={`/projects/${projectId}/roadblocks?status=${s}`}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s ? "bg-ink text-canvas" : "text-muted hover:bg-surface-soft hover:text-ink"
              }`}
            >
              {s === "OPEN" ? "Open" : s === "RESOLVED" ? "Resolved" : "All"}
            </Link>
          ))}
        </div>

        <div className="overflow-x-auto">
          <RoadblockLogTable
            roadblocks={roadblocks}
            members={memberOptions}
            canManage={canManageSchedule(role)}
            currentUserId={user.id}
          />
        </div>
      </div>
    </div>
  );
}
