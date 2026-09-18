import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { isProjectManager, canManageSchedule } from "@/lib/permissions";
import { TaskTable } from "@/components/TaskTable";
import { TaskForm } from "@/components/TaskForm";
import { ScheduleCsvImport } from "@/components/ScheduleCsvImport";
import { ArchiveProjectButton } from "@/components/ArchiveProjectButton";
import { formatDate } from "@/lib/utils";
import { ProjectPageHeader } from "@/components/PageHeader";
import { ProjectSetupChecklist } from "@/components/ProjectSetupChecklist";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, role, user } = await getProjectPageContext(projectId);

  const [tasks, members, attachmentCount, drawingCount, fieldPhotoCount, agentQuestionCount] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      include: { assignedTo: { include: { user: { select: { name: true } } } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.assistantAttachment.count({ where: { projectId } }),
    prisma.drawing.count({ where: { projectId } }),
    prisma.taskUpdate.count({ where: { photoUrl: { not: null }, task: { projectId } } }),
    prisma.assistantMessage.count({
      where: { role: "USER", conversation: { projectId } },
    }),
  ]);

  const canManage = canManageSchedule(role);
  const memberOptions = members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    role: m.role,
  }));
  const csvMembers = members.map((m) => ({ id: m.id, email: m.user.email, name: m.user.name }));
  const csvExistingTasks = tasks.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Master Schedule"
        description={`${formatDate(project.startDate)} - ${formatDate(project.endDate)} · Manage activities, ownership, dates, and live field status.`}
        actions={
          isProjectManager(role) ? (
            <ArchiveProjectButton projectId={project.id} isArchived={project.isArchived} />
          ) : undefined
        }
      />

      {isProjectManager(role) && !project.isArchived && (
        <ProjectSetupChecklist
          projectId={projectId}
          signals={{
            taskCount: tasks.length,
            memberCount: members.length,
            fileCount: attachmentCount + drawingCount + fieldPhotoCount,
            agentQuestionCount,
          }}
        />
      )}

      <div className="space-y-4">
        {canManage && (
          <div className="app-toolbar flex-wrap">
            <div>
              <p className="app-section-title">Schedule activities</p>
              <p className="app-section-description">{tasks.length} tasks in the current master schedule</p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 has-[[data-panel-open]]:basis-full">
              <ScheduleCsvImport projectId={projectId} members={csvMembers} existingTasks={csvExistingTasks} />
              <TaskForm projectId={projectId} members={memberOptions} />
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <TaskTable tasks={tasks} members={memberOptions} currentUserId={user.id} role={role} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
