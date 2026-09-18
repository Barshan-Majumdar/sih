import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { WeeklyPlanBoard } from "@/components/WeeklyPlanBoard";
import { Card } from "@/components/ui/Card";
import { formatDate, getWeekStart, percentComplete } from "@/lib/utils";
import { ProjectPageHeader } from "@/components/PageHeader";
import { hasProjectCapability } from "@/lib/permissions";
import { isFutureCommitmentWeek } from "@/lib/weekly-commitments";

export default async function ProjectWeeklyPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { projectId } = await params;
  const { week } = await searchParams;
  const { project, role, user } = await getProjectPageContext(projectId);

  const requestedWeek = week ? new Date(week) : new Date();
  const weekStart = getWeekStart(requestedWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const toParam = (d: Date) => d.toISOString().slice(0, 10);

  const [commitments, allTasks] = await Promise.all([
    prisma.weeklyCommitment.findMany({
      where: { weekStartDate: weekStart, removedAt: null, task: { projectId } },
      include: {
        task: { select: { id: true, name: true } },
        committedBy: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.findMany({
      where: { projectId },
      select: { id: true, name: true, assignedTo: { select: { userId: true } } },
    }),
  ]);

  const alreadyCommittedTaskIds = new Set(commitments.map((c) => c.task.id));
  const canCommitAny = hasProjectCapability(role, "COMMIT_ANY_TASK");
  const canRemoveForRole = hasProjectCapability(role, "COMMIT_ANY_TASK");
  const commitmentsForBoard = commitments.map((commitment) => ({
    ...commitment,
    canRemove:
      commitment.status === "COMMITTED" &&
      isFutureCommitmentWeek(commitment.weekStartDate) &&
      (canRemoveForRole || commitment.committedBy.user.id === user.id),
  }));
  const committableTasks = allTasks
    .filter((t) => !alreadyCommittedTaskIds.has(t.id))
    .filter((t) => canCommitAny || t.assignedTo?.userId === user.id)
    .map((t) => ({ id: t.id, name: t.name }));

  const totalCommitments = commitments.length;
  const completedCommitments = commitments.filter((c) => c.status === "COMPLETED").length;
  const ppc = percentComplete(totalCommitments, completedCommitments);

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Weekly Work Plan"
        description="Make field commitments visible and track Percent Plan Complete week over week."
      />

      <div className="mt-6 space-y-6">
        <div className="app-toolbar flex-row items-center">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${projectId}/weekly-plan?week=${toParam(prevWeek)}`}
              className="text-sm text-muted hover:text-ink"
            >
              ← Prev
            </Link>
            <p className="text-sm font-medium text-ink">
              {formatDate(weekStart)} – {formatDate(weekEnd)}
            </p>
            <Link
              href={`/projects/${projectId}/weekly-plan?week=${toParam(nextWeek)}`}
              className="text-sm text-muted hover:text-ink"
            >
              Next →
            </Link>
          </div>
          {totalCommitments > 0 && (
            <Card className="px-4 py-2">
              <span className="text-xs text-muted mr-2">PPC</span>
              <span className="font-display text-lg">{ppc}%</span>
            </Card>
          )}
        </div>

        <Card className="p-6">
          <WeeklyPlanBoard
            weekStartDate={weekStart.toISOString()}
            commitments={commitmentsForBoard}
            committableTasks={committableTasks}
          />
        </Card>
      </div>
    </div>
  );
}
