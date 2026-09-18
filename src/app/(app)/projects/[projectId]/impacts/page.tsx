import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canResolveRoadblocks } from "@/lib/permissions";
import { ScheduleImpactList } from "@/components/ScheduleImpactList";
import type { SirStatus } from "@prisma/client";
import { ProjectPageHeader } from "@/components/PageHeader";

export default async function ProjectImpactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { projectId } = await params;
  const { status } = await searchParams;
  const { project, role } = await getProjectPageContext(projectId);

  const statusFilter: SirStatus | "ALL" =
    status === "APPROVED" || status === "REJECTED" || status === "ALL" ? (status as SirStatus | "ALL") : "PENDING";

  const [sirs, tasks] = await Promise.all([
    prisma.scheduleImpactRequest.findMany({
      where: { projectId, ...(statusFilter === "ALL" ? {} : { status: statusFilter }) },
      include: {
        submittedBy: { include: { user: { select: { name: true } } } },
        reviewedBy: { include: { user: { select: { name: true } } } },
        task: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({ where: { projectId }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Schedule Impact Requests"
        description="Review requested schedule changes and preserve a clear approval trail."
      />

      <div className="mt-6 space-y-4">
        <div className="inline-flex items-center gap-1 rounded-md border border-hairline bg-canvas p-1">
          {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((s) => (
            <Link
              key={s}
              href={`/projects/${projectId}/impacts?status=${s}`}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s ? "bg-ink text-canvas" : "text-muted hover:bg-surface-soft hover:text-ink"
              }`}
            >
              {s === "PENDING" ? "Pending" : s === "APPROVED" ? "Approved" : s === "REJECTED" ? "Rejected" : "All"}
            </Link>
          ))}
        </div>

        <ScheduleImpactList projectId={projectId} sirs={sirs} tasks={tasks} canReview={canResolveRoadblocks(role)} />
      </div>
    </div>
  );
}
