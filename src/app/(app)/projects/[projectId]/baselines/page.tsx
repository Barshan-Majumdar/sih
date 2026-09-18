import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { BaselineCreateForm } from "@/components/BaselineCreateForm";
import { Card } from "@/components/ui/Card";
import { formatDate, daysBetween, TASK_STATUS_LABELS } from "@/lib/utils";
import { ProjectPageHeader } from "@/components/PageHeader";

export default async function ProjectBaselinesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ baselineId?: string }>;
}) {
  const { projectId } = await params;
  const { baselineId } = await searchParams;
  const { project, role } = await getProjectPageContext(projectId);

  const baselines = await prisma.baseline.findMany({
    where: { projectId },
    include: { createdBy: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const selectedId = baselineId ?? baselines[0]?.id;
  const selected = selectedId
    ? await prisma.baseline.findUnique({
        where: { id: selectedId },
        include: {
          snapshots: { orderBy: { taskName: "asc" } },
          createdBy: { include: { user: { select: { name: true } } } },
        },
      })
    : null;

  const currentTasks = selected
    ? await prisma.task.findMany({
        where: { id: { in: selected.snapshots.map((s) => s.taskId) } },
      })
    : [];
  const currentById = new Map(currentTasks.map((t) => [t.id, t]));

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Schedule Baselines"
        description="Save approved schedule states and compare current dates against the plan of record."
      />

      <div className="mt-6 space-y-6">
        {canManageSchedule(role) && <BaselineCreateForm projectId={projectId} />}

        {baselines.length === 0 ? (
          <p className="app-empty-title py-6 text-center">No baselines saved yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {baselines.map((b) => (
              <Link
                key={b.id}
                href={`/projects/${projectId}/baselines?baselineId=${b.id}`}
                className={`px-3.5 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  b.id === selectedId
                    ? "bg-surface-soft border-ink text-ink"
                    : "border-hairline text-muted hover:text-ink"
                }`}
              >
                {b.name} · {formatDate(b.createdAt)}
              </Link>
            ))}
          </div>
        )}

        {selected && (
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-hairline-soft text-sm text-muted">
              Comparing <span className="font-medium text-ink">{selected.name}</span> (saved{" "}
              {formatDate(selected.createdAt)} by {selected.createdBy?.user.name ?? "—"}) against current schedule
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline-soft text-left">
                    <th className="app-table-heading px-4 py-2">Task</th>
                    <th className="app-table-heading px-4 py-2">Baseline Dates</th>
                    <th className="app-table-heading px-4 py-2">Current Dates</th>
                    <th className="app-table-heading px-4 py-2">Variance</th>
                    <th className="app-table-heading px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.snapshots.map((s) => {
                    const current = currentById.get(s.taskId);
                    const variance = current ? daysBetween(s.endDate, current.endDate) : null;
                    return (
                      <tr key={s.id} className="border-b border-hairline-soft last:border-b-0">
                        <td className="px-4 py-2">{s.taskName}</td>
                        <td className="px-4 py-2 text-muted">
                          {formatDate(s.startDate)} – {formatDate(s.endDate)}
                        </td>
                        <td className="px-4 py-2 text-muted">
                          {current ? `${formatDate(current.startDate)} – ${formatDate(current.endDate)}` : "Task deleted"}
                        </td>
                        <td className="px-4 py-2">
                          {variance === null ? (
                            "—"
                          ) : variance === 0 ? (
                            <span className="text-success">On schedule</span>
                          ) : variance > 0 ? (
                            <span className="text-error">+{variance}d slip</span>
                          ) : (
                            <span className="text-success">{variance}d ahead</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted">
                          {TASK_STATUS_LABELS[s.status]}
                          {current && current.status !== s.status && (
                            <span className="text-muted-soft"> → {TASK_STATUS_LABELS[current.status]}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
