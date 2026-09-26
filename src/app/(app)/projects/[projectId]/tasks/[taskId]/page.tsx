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
      <Link href={`/projects/${projectId}`} className="btn-interactive inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition-colors">
        &larr; Back to {project.name}
      </Link>

      <div className="mb-6 mt-4 border-b border-hairline pb-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">Schedule activity</p>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink mb-3">{task.name}</h1>
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted font-mono">
          <span className="font-sans font-semibold text-ink">{task.assignedTo?.user.name ?? "Unassigned"}</span>
          <span className="text-muted/40">·</span>
          <span>
            {formatDate(task.startDate)} – {formatDate(task.endDate)}
          </span>
          <span className="text-muted/40">·</span>
          <StatusBadge status={task.status} />
          <span className="text-muted/40">·</span>
          <span className="font-bold text-ink">{task.progress}% complete</span>
          {task.isRoadblock && task.roadblockStatus && <RoadblockBadge status={task.roadblockStatus} />}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted font-mono">
          <span>
            <span className="font-sans font-medium text-ink">Actual start:</span>{" "}
            {task.actualStartDate ? formatDate(task.actualStartDate) : "Not set"}
          </span>
          <span>
            <span className="font-sans font-medium text-ink">Actual finish:</span>{" "}
            {task.actualFinishDate ? formatDate(task.actualFinishDate) : "Not set"}
          </span>
        </div>
        {task.isRoadblock && task.roadblockNote && (
          <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-xs text-rose-800 dark:text-rose-200">{task.roadblockNote}</p>
        )}
      </div>

      {hasRelatedItems && (
        <div className="rounded-2xl border border-hairline bg-canvas p-6 shadow-card mb-6">
          <h2 className="text-sm font-semibold tracking-tight text-ink mb-4">Related Items</h2>
          <div className="space-y-4">
            {submittals.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Submittals</p>
                <ul className="space-y-1.5">
                  {submittals.map((s) => {
                    const overdue = s.status === "PENDING" && s.dueDate && new Date(s.dueDate) < new Date();
                    return (
                      <li key={s.id} className="text-xs flex items-center gap-2">
                        <Link href={`/projects/${projectId}/submittals`} className="font-medium text-ink hover:underline">
                          {s.title}
                        </Link>
                        <span className={`text-[11px] font-mono ${overdue ? "text-rose-600 dark:text-rose-400 font-bold" : "text-muted"}`}>
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
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">RFIs</p>
                <ul className="space-y-1.5">
                  {rfis.map((r) => {
                    const overdue = r.status === "OPEN" && r.dueDate && new Date(r.dueDate) < new Date();
                    return (
                      <li key={r.id} className="text-xs flex items-center gap-2">
                        <Link href={`/projects/${projectId}/rfis`} className="font-medium text-ink hover:underline">
                          {r.question}
                        </Link>
                        <span className={`text-[11px] font-mono ${overdue ? "text-rose-600 dark:text-rose-400 font-bold" : "text-muted"}`}>
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
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Drawings</p>
                <ul className="space-y-1.5">
                  {drawings.map((d) => (
                    <li key={d.id} className="text-xs">
                      <Link href={`/projects/${projectId}/drawings`} className="font-medium text-ink hover:underline">
                        {d.title}
                      </Link>
                      <span className="text-muted font-mono"> rev {d.revision}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sirs.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Schedule Impact Requests</p>
                <ul className="space-y-1.5">
                  {sirs.map((sir) => (
                    <li key={sir.id} className="text-xs">
                      <Link href={`/projects/${projectId}/impacts`} className="font-medium text-ink hover:underline">
                        {sir.description}
                      </Link>
                      <span className="text-muted font-mono"> · {sir.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-hairline bg-canvas p-6 shadow-card">
        <h2 className="text-sm font-semibold tracking-tight text-ink mb-4">Field Tracking</h2>
        <TaskUpdateFeed taskId={task.id} updates={securedUpdates} />
      </div>
    </div>
  );
}
