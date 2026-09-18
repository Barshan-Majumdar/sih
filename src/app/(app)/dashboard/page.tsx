import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { OrgSubNav } from "@/components/OrgSubNav";
import { Card } from "@/components/ui/Card";
import { AppPageHeader } from "@/components/PageHeader";
import { loadProjectSummary, healthColor } from "@/lib/project-summary";

export default async function ExecutiveDashboardPage() {
  const { user, organizationId } = await requireActiveOrganization();

  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      isArchived: false,
      members: { some: { userId: user.id } },
    },
    orderBy: { createdAt: "desc" },
  });

  const summaries = await Promise.all(
    projects.map(async (p) => ({ project: p, summary: await loadProjectSummary(p.id) }))
  );

  const orgTotals = summaries.reduce(
    (acc, { summary }) => ({
      totalTasks: acc.totalTasks + summary.totalTasks,
      openRoadblocks: acc.openRoadblocks + summary.openRoadblocks,
      healthScores: summary.healthScore !== null ? [...acc.healthScores, summary.healthScore] : acc.healthScores,
    }),
    { totalTasks: 0, openRoadblocks: 0, healthScores: [] as number[] }
  );
  const avgHealthScore =
    orgTotals.healthScores.length > 0
      ? Math.round(orgTotals.healthScores.reduce((a, b) => a + b, 0) / orgTotals.healthScores.length)
      : null;

  return (
    <div className="app-page">
      <AppPageHeader
        eyebrow="Portfolio control"
        title="Executive Dashboard"
        description="Portfolio-wide schedule health, execution risk, and delivery performance across active projects."
      />

      <OrgSubNav active="Executive Dashboard" />

      <div className="mt-8 space-y-6">
        {projects.length === 0 ? (
          <Card className="p-14 text-center">
            <p className="app-empty-title">No active projects yet</p>
            <p className="mt-2 text-sm text-muted">Create a project to start tracking portfolio health.</p>
          </Card>
        ) : (
          <>
            <div className="app-section-heading">
              <div>
                <h2 className="app-section-title">Portfolio health</h2>
                <p className="app-section-description">The current operating picture across active projects.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Card className="relative overflow-hidden p-5">
                <span className="absolute inset-x-0 top-0 h-0.5 bg-ink" />
                <p className="app-metric-label">Active projects</p>
                <p className="app-metric-value">{projects.length}</p>
                <p className="app-metric-helper">Currently in delivery</p>
              </Card>
              <Card className="relative overflow-hidden p-5">
                <span className="absolute inset-x-0 top-0 h-0.5 bg-brand-accent" />
                <p className="app-metric-label">Total tasks</p>
                <p className="app-metric-value">{orgTotals.totalTasks}</p>
                <p className="app-metric-helper">Across active schedules</p>
              </Card>
              <Card className="relative overflow-hidden p-5">
                <span className={`absolute inset-x-0 top-0 h-0.5 ${orgTotals.openRoadblocks > 0 ? "bg-error" : "bg-success"}`} />
                <p className="app-metric-label">Open roadblocks</p>
                <p className={`app-metric-value ${orgTotals.openRoadblocks > 0 ? "text-error" : ""}`}>
                  {orgTotals.openRoadblocks}
                </p>
                <p className="app-metric-helper">Needs owner attention</p>
              </Card>
              <Card className="relative overflow-hidden p-5">
                <span className="absolute inset-x-0 top-0 h-0.5 bg-success" />
                <p className="app-metric-label">Average health</p>
                <p className={`app-metric-value ${healthColor(avgHealthScore)}`}>{avgHealthScore ?? "-"}</p>
                <p className="app-metric-helper">Portfolio score</p>
              </Card>
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="border-b border-hairline-soft px-4 py-4">
                <h2 className="app-section-title">Active project performance</h2>
                <p className="app-section-description">Schedule, reliability, variance, and constraints by project.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline-soft bg-surface-soft text-left">
                      <th className="app-table-heading px-4 py-2.5">Project</th>
                      <th className="app-table-heading px-4 py-2.5 text-right">% Complete</th>
                      <th className="app-table-heading px-4 py-2.5 text-right">PPC</th>
                      <th className="app-table-heading px-4 py-2.5 text-right">PRR</th>
                      <th className="app-table-heading px-4 py-2.5 text-right">Variance</th>
                      <th className="app-table-heading px-4 py-2.5 text-right">Roadblocks</th>
                      <th className="app-table-heading px-4 py-2.5 text-right">Health Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.map(({ project, summary }) => (
                      <tr key={project.id} className="app-table-row border-b border-hairline-soft last:border-b-0">
                        <td className="px-4 py-3">
                          <Link href={`/projects/${project.id}/dashboard`} className="font-medium text-ink hover:underline">
                            {project.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right text-muted">{summary.percentComplete}%</td>
                        <td className="px-4 py-3 text-right text-muted">{summary.ppc !== null ? `${summary.ppc}%` : "—"}</td>
                        <td className="px-4 py-3 text-right text-muted">{summary.prr !== null ? `${summary.prr}%` : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {summary.variance === null ? (
                            <span className="text-muted">—</span>
                          ) : summary.variance <= 0 ? (
                            <span className="text-success">{summary.variance === 0 ? "On track" : `${summary.variance}d ahead`}</span>
                          ) : (
                            <span className="text-error">+{summary.variance}d</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={summary.openRoadblocks > 0 ? "text-error font-medium" : "text-muted"}>
                            {summary.openRoadblocks}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${healthColor(summary.healthScore)}`}>
                            {summary.healthScore ?? "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
