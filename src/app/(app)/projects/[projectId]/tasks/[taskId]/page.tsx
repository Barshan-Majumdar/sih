import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { StatusBadge } from "@/components/StatusBadge";
import { RoadblockBadge } from "@/components/RoadblockBadge";
import { TaskUpdateFeed } from "@/components/TaskUpdateFeed";
import { Card } from "@/components/ui/Card";
import { formatDate, SUBMITTAL_STATUS_LABELS, RFI_STATUS_LABELS } from "@/lib/utils";
import { privateStoredFileUrl } from "@/lib/storage";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;
  const { project } = await getProjectPageContext(projectId);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedTo: { include: { user: { select: { name: true } } } },
      updates: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!task || task.projectId !== projectId) notFound();
  const securedUpdates = task.updates.map((update) => ({
    ...update,
    photoUrl: update.photoUrl ? privateStoredFileUrl(update.photoUrl) : null,
  }));

  const [submittals, rfis, drawings, sirs] = await Promise.all([
    prisma.submittal.findMany({ where: { taskId }, orderBy: { createdAt: "desc" } }),
    prisma.rFI.findMany({ where: { taskId }, orderBy: { createdAt: "desc" } }),
    prisma.drawing.findMany({ where: { taskId, isSuperseded: false }, orderBy: { createdAt: "desc" } }),
    prisma.scheduleImpactRequest.findMany({ where: { taskId }, orderBy: { createdAt: "desc" } }),
  ]);
  const hasRelatedItems = submittals.length > 0 || rfis.length > 0 || drawings.length > 0 || sirs.length > 0;

  return (
    <div className="app-page app-page-narrow">
      <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink">
        ← Back to {project.name}
      </Link>

      <div className="mb-6 mt-5 border-b border-hairline pb-6">
        <p className="app-kicker mb-2">Schedule activity</p>
        <h1 className="app-page-title mb-3">{task.name}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>{task.assignedTo?.user.name ?? "Unassigned"}</span>
          <span>·</span>
          <span>
            {formatDate(task.startDate)} – {formatDate(task.endDate)}
          </span>
          <span>·</span>
          <StatusBadge status={task.status} />
          <span>·</span>
          <span>{task.progress}% complete</span>
          {task.isRoadblock && task.roadblockStatus && <RoadblockBadge status={task.roadblockStatus} />}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
          <span>
            <span className="font-medium text-body">Actual start:</span>{" "}
            {task.actualStartDate ? formatDate(task.actualStartDate) : "Not set"}
          </span>
          <span>
            <span className="font-medium text-body">Actual finish:</span>{" "}
            {task.actualFinishDate ? formatDate(task.actualFinishDate) : "Not set"}
          </span>
        </div>
        {task.isRoadblock && task.roadblockNote && (
          <p className="mt-4 rounded-md border border-error/20 bg-error/5 px-3 py-2 text-sm text-body">{task.roadblockNote}</p>
        )}
      </div>

      {hasRelatedItems && (
        <Card className="p-6 mb-6">
          <h2 className="app-section-title mb-4">Related Items</h2>
          <div className="space-y-4">
            {submittals.length > 0 && (
              <div>
                <p className="app-table-heading mb-1.5">Submittals</p>
                <ul className="space-y-1">
                  {submittals.map((s) => {
                    const overdue = s.status === "PENDING" && s.dueDate && new Date(s.dueDate) < new Date();
                    return (
                      <li key={s.id} className="text-sm flex items-center gap-2">
                        <Link href={`/projects/${projectId}/submittals`} className="text-ink hover:underline">
                          {s.title}
                        </Link>
                        <span className={`text-xs ${overdue ? "text-error font-medium" : "text-muted"}`}>
                          {SUBMITTAL_STATUS_LABELS[s.status]}
                          {overdue ? " — overdue" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {rfis.length > 0 && (
              <div>
                <p className="app-table-heading mb-1.5">RFIs</p>
                <ul className="space-y-1">
                  {rfis.map((r) => {
                    const overdue = r.status === "OPEN" && r.dueDate && new Date(r.dueDate) < new Date();
                    return (
                      <li key={r.id} className="text-sm flex items-center gap-2">
                        <Link href={`/projects/${projectId}/rfis`} className="text-ink hover:underline">
                          {r.question}
                        </Link>
                        <span className={`text-xs ${overdue ? "text-error font-medium" : "text-muted"}`}>
                          {RFI_STATUS_LABELS[r.status]}
                          {overdue ? " — overdue" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {drawings.length > 0 && (
              <div>
                <p className="app-table-heading mb-1.5">Drawings</p>
                <ul className="space-y-1">
                  {drawings.map((d) => (
                    <li key={d.id} className="text-sm">
                      <Link href={`/projects/${projectId}/drawings`} className="text-ink hover:underline">
                        {d.title}
                      </Link>
                      <span className="text-xs text-muted"> rev {d.revision}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sirs.length > 0 && (
              <div>
                <p className="app-table-heading mb-1.5">Schedule Impact Requests</p>
                <ul className="space-y-1">
                  {sirs.map((sir) => (
                    <li key={sir.id} className="text-sm">
                      <Link href={`/projects/${projectId}/impacts`} className="text-ink hover:underline">
                        {sir.description}
                      </Link>
                      <span className="text-xs text-muted"> · {sir.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="app-section-title mb-4">Field Tracking</h2>
        <TaskUpdateFeed taskId={task.id} updates={securedUpdates} />
      </Card>
    </div>
  );
}
