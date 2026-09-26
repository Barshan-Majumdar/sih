import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { DashboardStats } from "@/components/DashboardStats";
import { PpcTrendChart } from "@/components/PpcTrendChart";
import { PrrTable } from "@/components/PrrTable";
import { SCurveChart } from "@/components/SCurveChart";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, percentComplete } from "@/lib/utils";
import { computePpcTrend, computePrrByMember, computeSCurve } from "@/lib/analytics";
import { ProjectPageHeader } from "@/components/PageHeader";
import {
  ArrowRight,
  Building2,
  Calendar,
  ChartGantt,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
} from "lucide-react";

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project } = await getProjectPageContext(projectId);

  const [
    totalTasks,
    doneTasks,
    openRoadblocks,
    commitments,
    allTasks,
    projectTasks,
    orgProjects,
  ] = await Promise.all([
    prisma.task.count({ where: { projectId } }),
    prisma.task.count({ where: { projectId, status: "DONE" } }),
    prisma.task.count({ where: { projectId, isRoadblock: true, roadblockStatus: "OPEN" } }),
    prisma.weeklyCommitment.findMany({
      where: { removedAt: null, task: { projectId } },
      include: { committedBy: { include: { user: { select: { name: true } } } } },
      orderBy: { weekStartDate: "asc" },
    }),
    prisma.task.findMany({
      where: { projectId },
      select: { endDate: true, status: true, updatedAt: true },
    }),
    prisma.task.findMany({
      where: { projectId },
      include: { assignedTo: { include: { user: { select: { name: true } } } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.project.findMany({
      where: { organizationId: project.organizationId, isArchived: false },
      include: { tasks: { select: { status: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const ppcTrend = computePpcTrend(commitments);
  const prrByMember = computePrrByMember(
    commitments.map((c) => ({
      committedById: c.committedById,
      committedByName: c.committedBy.user.name,
      status: c.status,
    }))
  );
  const today = new Date();
  const sCurveRangeEnd = project.endDate > today ? project.endDate : today;
  const sCurve = computeSCurve(allTasks, project.startDate, sCurveRangeEnd);

  return (
    <div className="app-page space-y-6">
      {/* Clear Navigation Breadcrumb Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline/80 pb-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted">
          <Link href="/dashboard" className="hover:text-ink transition-colors flex items-center gap-1">
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-soft" />
          <Link href="/projects" className="hover:text-ink transition-colors">
            Projects
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-soft" />
          <span className="font-semibold text-ink">{project.name}</span>
          <span className="rounded-pill bg-surface-soft border border-hairline px-2 py-0.5 text-[10px] font-mono text-muted">
            Analytics
          </span>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-strong shadow-sm"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-brand-accent" />
            <span>Portfolio Dashboard</span>
          </Link>
          <Link
            href={`/tasks/${projectId}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-canvas px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-soft shadow-sm"
          >
            <ListTodo className="h-3.5 w-3.5 text-muted" />
            <span>Tasks</span>
          </Link>
          <Link
            href={`/gantt/${projectId}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-canvas px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-soft shadow-sm"
          >
            <ChartGantt className="h-3.5 w-3.5 text-muted" />
            <span>Gantt Chart</span>
            <ArrowRight className="h-3 w-3 text-muted" />
          </Link>
        </div>
      </div>

      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title={`${project.name} — Project Analytics`}
        description={`${formatDate(project.startDate)} – ${formatDate(project.endDate)} · Live completion status, S-Curve trends, and reliability for this project.`}
      />

      {/* Quick Project Switcher / Workspace Context */}
      <Card className="p-4 shadow-sm bg-surface-soft/40 border-hairline">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-brand-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Workspace Projects ({orgProjects.length})
            </span>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-brand-accent hover:underline flex items-center gap-1"
          >
            <span>View all in Portfolio Dashboard</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {orgProjects.map((p) => {
            const isCurrent = p.id === projectId;
            const pTotal = p.tasks.length;
            const pDone = p.tasks.filter((t) => t.status === "DONE").length;
            const pCompletion = percentComplete(pTotal, pDone);

            return (
              <Link
                key={p.id}
                href={`/dashboard/${p.id}`}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${
                  isCurrent
                    ? "border-brand-accent bg-brand-accent/10 font-semibold text-ink ring-1 ring-brand-accent/30 shadow-sm"
                    : "border-hairline bg-surface-card font-medium text-muted hover:border-muted-soft hover:text-ink hover:bg-surface-soft"
                }`}
              >
                <Building2 className={`h-3.5 w-3.5 ${isCurrent ? "text-brand-accent" : "text-muted"}`} />
                <span>{p.name}</span>
                <span className="font-mono text-[11px] text-muted-soft tabular-nums">
                  ({pCompletion}%)
                </span>
                {isCurrent && (
                  <span className="rounded-full bg-brand-accent h-1.5 w-1.5" title="Current project" />
                )}
              </Link>
            );
          })}
        </div>
      </Card>

      {/* KPI Stats */}
      <DashboardStats
        totalTasks={totalTasks}
        percentComplete={percentComplete(totalTasks, doneTasks)}
        openRoadblocks={openRoadblocks}
      />

      {/* Project Schedule Activities List */}
      <Card className="p-0 overflow-hidden shadow-card border-hairline">
        <div className="flex flex-wrap items-center justify-between border-b border-hairline bg-surface-soft px-5 py-4 gap-2">
          <div>
            <h3 className="app-card-title text-sm font-semibold text-ink flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-brand-accent" />
              <span>Project Activities & Deliverables ({projectTasks.length})</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Current schedule activities tracked for {project.name}.
            </p>
          </div>
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-accent hover:underline"
          >
            <span>Open in Master Schedule</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {projectTasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            <p>No activities added to this project yet.</p>
            <Link
              href={`/projects/${projectId}`}
              className="mt-2 inline-block font-semibold text-brand-accent hover:underline"
            >
              + Add first activity in Master Schedule
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-hairline bg-surface-soft/60 text-left text-muted font-medium">
                  <th className="py-2.5 px-4 font-mono">#</th>
                  <th className="py-2.5 px-3">Activity</th>
                  <th className="py-2.5 px-3">Assignee</th>
                  <th className="py-2.5 px-3 font-mono">Start Date</th>
                  <th className="py-2.5 px-3 font-mono">End Date</th>
                  <th className="py-2.5 px-3">Progress</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline-soft">
                {projectTasks.map((task, index) => (
                  <tr key={task.id} className="hover:bg-surface-soft/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-muted">{index + 1}</td>
                    <td className="py-3 px-3 font-semibold text-ink">
                      <Link
                        href={`/tasks/${projectId}?taskId=${task.id}`}
                        className="hover:text-brand-accent transition-colors"
                      >
                        {task.name}
                      </Link>
                    </td>
                    <td className="py-3 px-3 text-muted">
                      {task.assignedTo?.user.name ?? <span className="text-muted-soft italic">Unassigned</span>}
                    </td>
                    <td className="py-3 px-3 font-mono text-muted">{formatDate(task.startDate)}</td>
                    <td className="py-3 px-3 font-mono text-muted">{formatDate(task.endDate)}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 w-28">
                        <div className="flex-1 h-1.5 rounded-full bg-surface-strong overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              task.progress === 100 ? "bg-success" : task.progress > 0 ? "bg-brand-accent" : "bg-muted-soft"
                            }`}
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-muted">{task.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <StatusBadge status={task.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* S-Curve and Reliability Analytics */}
      {totalTasks > 0 && (
        <div className="space-y-6">
          <div className="app-section-heading">
            <div>
              <h2 className="app-section-title">Schedule Analytics & Progress Curves</h2>
              <p className="app-section-description">
                Cumulative baseline vs. verified progress and trade reliability for {project.name}.
              </p>
            </div>
          </div>

          <Card className="p-6 shadow-card">
            <h3 className="app-card-title">Schedule Progress (S-Curve)</h3>
            <p className="app-card-description mb-4">
              Planned vs. actual cumulative task completion over time
            </p>
            <SCurveChart sCurve={sCurve} />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-6 shadow-card">
              <h3 className="app-card-title">PPC Trend</h3>
              <p className="app-card-description mb-4">Percent Plan Complete, by committed week</p>
              <PpcTrendChart ppcTrend={ppcTrend} />
            </Card>

            <Card className="p-6 shadow-card">
              <h3 className="app-card-title">Promise Reliability Rate (PRR)</h3>
              <p className="app-card-description mb-4">Commitment completion rate by trade partner</p>
              <PrrTable prrByMember={prrByMember} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
