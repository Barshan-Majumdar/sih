import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { SubmittalList } from "@/components/SubmittalList";
import type { SubmittalStatus } from "@prisma/client";
import { ProjectPageHeader } from "@/components/PageHeader";
import { privateStoredFileUrl } from "@/lib/storage";

export default async function ProjectSubmittalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { projectId } = await params;
  const { status } = await searchParams;
  const { project, role } = await getProjectPageContext(projectId);

  const validStatuses: (SubmittalStatus | "ALL")[] = ["PENDING", "APPROVED", "REJECTED", "REVISE_RESUBMIT", "ALL"];
  const statusFilter = validStatuses.includes(status as never) ? (status as SubmittalStatus | "ALL") : "ALL";

  const [submittals, tasks] = await Promise.all([
    prisma.submittal.findMany({
      where: { projectId, ...(statusFilter === "ALL" ? {} : { status: statusFilter }) },
      include: {
        submittedBy: { include: { user: { select: { name: true } } } },
        task: { select: { id: true, name: true } },
        attachment: { select: { fileName: true, fileUrl: true, searchableFileUrl: true } },
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
        title="Submittals Log"
        description="Track decisions and due dates that can affect scheduled work."
      />

      <div className="mt-6 space-y-4">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-hairline bg-canvas p-1">
          {(["ALL", "PENDING", "APPROVED", "REJECTED", "REVISE_RESUBMIT"] as const).map((s) => (
            <Link
              key={s}
              href={`/projects/${projectId}/submittals?status=${s}`}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s ? "bg-ink text-canvas" : "text-muted hover:bg-surface-soft hover:text-ink"
              }`}
            >
              {s === "ALL" ? "All" : s === "REVISE_RESUBMIT" ? "Revise" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>

        <SubmittalList
          projectId={projectId}
          submittals={submittals.map((submittal) => ({
            ...submittal,
            attachment: submittal.attachment
              ? {
                  fileName: submittal.attachment.fileName,
                  fileUrl: privateStoredFileUrl(
                    submittal.attachment.searchableFileUrl ?? submittal.attachment.fileUrl
                  ),
                }
              : null,
          }))}
          tasks={tasks}
          canDecide={canManageSchedule(role)}
        />
      </div>
    </div>
  );
}
