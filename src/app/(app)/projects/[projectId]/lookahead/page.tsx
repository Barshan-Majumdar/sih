import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { TaskTable } from "@/components/TaskTable";
import { formatDate } from "@/lib/utils";
import { ProjectPageHeader } from "@/components/PageHeader";

const WINDOW_OPTIONS = [2, 4, 6] as const;
const DEFAULT_WINDOW_WEEKS = 4;

export default async function ProjectLookaheadPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ weeks?: string }>;
}) {
  const { projectId } = await params;
  const { weeks } = await searchParams;
  const { project, role, user } = await getProjectPageContext(projectId);

  const windowWeeks = WINDOW_OPTIONS.includes(Number(weeks) as (typeof WINDOW_OPTIONS)[number])
    ? Number(weeks)
    : DEFAULT_WINDOW_WEEKS;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + windowWeeks * 7);

  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      where: {
        projectId,
        startDate: { lte: windowEnd },
        endDate: { gte: today },
      },
      include: { assignedTo: { include: { user: { select: { name: true } } } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const memberOptions = members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    role: m.role,
  }));

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Lookahead"
        description={`Coordinate the next ${windowWeeks} weeks of field-ready work from the live master schedule.`}
      />

      <div className="mt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-2xl border border-hairline bg-surface-soft/60">
          <p className="text-xs sm:text-sm font-semibold tracking-tight text-ink font-mono">
            {formatDate(today)} – {formatDate(windowEnd)}
          </p>
          <div className="inline-flex items-center gap-1 rounded-xl border border-hairline/80 bg-surface-soft/80 p-1">
            {WINDOW_OPTIONS.map((w) => (
              <Link
                key={w}
                href={`/projects/${projectId}/lookahead?weeks=${w}`}
                className={`btn-interactive px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all ${
                  w === windowWeeks
                    ? "bg-ink text-canvas shadow-xs"
                    : "text-muted hover:bg-canvas hover:text-ink"
                }`}
              >
                {w}-week
              </Link>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <TaskTable tasks={tasks} members={memberOptions} currentUserId={user.id} role={role} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
