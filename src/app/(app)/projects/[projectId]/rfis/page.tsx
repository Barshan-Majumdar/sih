import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { syncOverdueRfiFlags } from "@/lib/rfi-overdue";
import { RfiList } from "@/components/RfiList";
import { privateStoredFileUrl } from "@/lib/storage";
import type { RfiStatus } from "@prisma/client";
import { ProjectPageHeader } from "@/components/PageHeader";

export default async function ProjectRfisPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { projectId } = await params;
  const { status } = await searchParams;
  const { project, role } = await getProjectPageContext(projectId);

  await syncOverdueRfiFlags(projectId);

  const validStatuses: (RfiStatus | "ALL")[] = ["OPEN", "ANSWERED", "CLOSED", "ALL"];
  const statusFilter = validStatuses.includes(status as never) ? (status as RfiStatus | "ALL") : "OPEN";

  const [rfis, tasks, files] = await Promise.all([
    prisma.rFI.findMany({
      where: { projectId, ...(statusFilter === "ALL" ? {} : { status: statusFilter }) },
      include: {
        raisedBy: { include: { user: { select: { name: true } } } },
        task: { select: { id: true, name: true } },
        attachment: {
          select: { id: true, fileName: true, fileUrl: true, searchableFileUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({ where: { projectId }, select: { id: true, name: true } }),
    prisma.assistantAttachment.findMany({
      where: { projectId },
      select: { id: true, fileName: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Requests for Information"
        description="Connect RFIs to scheduled work so overdue answers remain visible as delivery risk."
      />

      <div className="mt-6 space-y-4">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-hairline bg-canvas p-1">
          {(["OPEN", "ANSWERED", "CLOSED", "ALL"] as const).map((s) => (
            <Link
              key={s}
              href={`/projects/${projectId}/rfis?status=${s}`}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s ? "bg-ink text-canvas" : "text-muted hover:bg-surface-soft hover:text-ink"
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>

        <RfiList
          projectId={projectId}
          rfis={rfis.map((rfi) => ({
            ...rfi,
            attachment: rfi.attachment
              ? {
                  id: rfi.attachment.id,
                  fileName: rfi.attachment.fileName,
                  url: privateStoredFileUrl(
                    rfi.attachment.searchableFileUrl ?? rfi.attachment.fileUrl
                  ),
                }
              : null,
          }))}
          tasks={tasks}
          files={files}
          canAnswer={canManageSchedule(role)}
        />
      </div>
    </div>
  );
}
