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
          <div className="rounded-2xl border border-dashed border-hairline bg-surface-soft/40 px-6 py-12 text-center">
            <p className="text-sm font-semibold tracking-tight text-ink">No baselines saved yet</p>
            <p className="mt-1 text-xs text-muted">Use the form above to snapshot the current plan of record.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {baselines.map((b) => (
              <Link
                key={b.id}
                href={`/projects/${projectId}/baselines?baselineId=${b.id}`}
                className={`btn-interactive px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight border transition-all ${
                  b.id === selectedId
                    ? "bg-ink border-ink text-canvas shadow-xs"
                    : "bg-surface-soft border-hairline text-muted hover:text-ink hover:bg-canvas shadow-2xs"
                }`}
              >
                {b.name} · <span className="font-mono">{formatDate(b.createdAt)}</span>
              </Link>
            ))}
          </div>
        )}

        {selected && (
          <div className="rounded-2xl border border-hairline bg-canvas shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-hairline bg-surface-soft/40 text-xs text-muted font-medium">
              Comparing <span className="font-semibold text-ink">{selected.name}</span> (saved{" "}
              <span className="font-mono">{formatDate(selected.createdAt)}</span> by {selected.createdBy?.user.name ?? "—"}) against current schedule
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-hairline bg-surface-soft/80 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Baseline Dates</th>
                    <th className="px-4 py-3">Current Dates</th>
                    <th className="px-4 py-3">Variance</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {selected.snapshots.map((s) => {
                    const current = currentById.get(s.taskId);
                    const variance = current ? daysBetween(s.endDate, current.endDate) : null;
                    return (
                      <tr key={s.id} className="hover:bg-surface-soft/40 transition-colors">
                        <td className="px-4 py-3.5 font-semibold tracking-tight text-ink">{s.taskName}</td>
                        <td className="px-4 py-3.5 text-xs text-muted font-mono">
                          {formatDate(s.startDate)} – {formatDate(s.endDate)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted font-mono">
                          {current ? `${formatDate(current.startDate)} – ${formatDate(current.endDate)}` : "Task deleted"}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-mono">
                          {variance === null ? (
                            <span className="text-muted">—</span>
                          ) : variance === 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">On schedule</span>
                          ) : variance > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">+{variance}d slip</span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">{variance}d ahead</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs font-medium text-muted">
                          {TASK_STATUS_LABELS[s.status]}
                          {current && current.status !== s.status && (
                            <span className="text-muted/60"> &rarr; {TASK_STATUS_LABELS[current.status]}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
