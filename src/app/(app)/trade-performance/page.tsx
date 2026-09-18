import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { OrgSubNav } from "@/components/OrgSubNav";
import { Card } from "@/components/ui/Card";
import { PROJECT_ROLE_LABELS } from "@/lib/utils";
import { AppPageHeader } from "@/components/PageHeader";

export default async function TradePerformancePage() {
  const { user, organizationId } = await requireActiveOrganization();

  const commitments = await prisma.weeklyCommitment.findMany({
    where: {
      removedAt: null,
      task: {
        project: {
          organizationId,
          isArchived: false,
          members: { some: { userId: user.id } },
        },
      },
    },
    include: {
      committedBy: { include: { user: { select: { id: true, name: true } } } },
      task: { select: { projectId: true } },
    },
  });

  type Row = {
    userId: string;
    name: string;
    total: number;
    completed: number;
    notCompleted: number;
    projectIds: Set<string>;
    roles: Set<string>;
  };

  const byUser = new Map<string, Row>();
  for (const c of commitments) {
    const userId = c.committedBy.user.id;
    const row = byUser.get(userId) ?? {
      userId,
      name: c.committedBy.user.name,
      total: 0,
      completed: 0,
      notCompleted: 0,
      projectIds: new Set<string>(),
      roles: new Set<string>(),
    };
    row.total += 1;
    if (c.status === "COMPLETED") row.completed += 1;
    if (c.status === "NOT_COMPLETED") row.notCompleted += 1;
    row.projectIds.add(c.task.projectId);
    row.roles.add(c.committedBy.role);
    byUser.set(userId, row);
  }

  const rows = [...byUser.values()]
    .map((r) => ({
      ...r,
      prr: r.total === 0 ? 0 : Math.round((r.completed / r.total) * 100),
      projectCount: r.projectIds.size,
      roleLabel: [...r.roles].map((role) => PROJECT_ROLE_LABELS[role as keyof typeof PROJECT_ROLE_LABELS]).join(", "),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="app-page">
      <AppPageHeader
        eyebrow="Portfolio control"
        title="Trade Performance"
        description="Review commitment reliability by person and trade across every active project."
      />

      <OrgSubNav active="Trade Performance" />

      <div className="mt-8">
        {rows.length === 0 ? (
          <Card className="p-14 text-center">
            <p className="text-sm text-muted">
              No commitments recorded yet — this fills in once trades commit to tasks on each project&apos;s Weekly
              Plan.
            </p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-hairline-soft px-4 py-4">
              <h2 className="app-section-title">Commitment reliability</h2>
              <p className="app-section-description">Completed commitments by member across active projects.</p>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline-soft bg-surface-soft text-left">
                  <th className="app-table-heading px-4 py-2.5">Member</th>
                  <th className="app-table-heading px-4 py-2.5">Role(s)</th>
                  <th className="app-table-heading px-4 py-2.5 text-right">Projects</th>
                  <th className="app-table-heading px-4 py-2.5 text-right">Commitments</th>
                  <th className="app-table-heading px-4 py-2.5 text-right">PRR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId} className="app-table-row border-b border-hairline-soft last:border-b-0">
                    <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                    <td className="px-4 py-3 text-muted">{row.roleLabel}</td>
                    <td className="px-4 py-3 text-right text-muted">{row.projectCount}</td>
                    <td className="px-4 py-3 text-right text-muted">
                      {row.completed}/{row.total}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={row.prr >= 80 ? "text-success" : row.prr >= 50 ? "text-ink" : "text-error"}>
                        {row.prr}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
