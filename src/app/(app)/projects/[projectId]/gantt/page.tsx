import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { computeCriticalPath } from "@/lib/critical-path";
import { GanttChart } from "@/components/GanttChart";
import { TaskDependencyManager } from "@/components/TaskDependencyManager";
import { ProjectPageHeader } from "@/components/PageHeader";

export default async function ProjectGanttPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, role } = await getProjectPageContext(projectId);

  const [tasks, dependencies] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      include: { assignedTo: { include: { user: { select: { name: true } } } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.taskDependency.findMany({
      where: { predecessor: { projectId } },
      select: { id: true, predecessorId: true, successorId: true },
    }),
  ]);

  const criticalTaskIds = computeCriticalPath(tasks, dependencies);

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Gantt Schedule"
        description="Review timing, dependencies, and critical path movement across the master schedule."
      />

      <div className="mt-6 space-y-6">
        <GanttChart
          tasks={tasks}
          rangeStart={project.startDate}
          rangeEnd={project.endDate}
          criticalTaskIds={[...criticalTaskIds]}
          dependencies={dependencies}
          canEdit={canManageSchedule(role)}
        />

        <TaskDependencyManager
          projectId={projectId}
          tasks={tasks.map((t) => ({ id: t.id, name: t.name }))}
          dependencies={dependencies}
          canManage={canManageSchedule(role)}
        />
      </div>
    </div>
  );
}
