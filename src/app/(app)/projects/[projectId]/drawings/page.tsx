import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { canManageSchedule } from "@/lib/permissions";
import { DrawingList } from "@/components/DrawingList";
import { ProjectPageHeader } from "@/components/PageHeader";
import { privateStoredFileUrl } from "@/lib/storage";

export default async function ProjectDrawingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, role } = await getProjectPageContext(projectId);

  const [drawings, tasks] = await Promise.all([
    prisma.drawing.findMany({
      where: { projectId },
      include: {
        uploadedBy: { include: { user: { select: { name: true } } } },
        task: { select: { id: true, name: true } },
      },
      orderBy: [{ title: "asc" }, { revision: "desc" }],
    }),
    prisma.task.findMany({ where: { projectId }, select: { id: true, name: true } }),
  ]);
  const securedDrawings = drawings.map((drawing) => ({
    ...drawing,
    fileUrl: privateStoredFileUrl(drawing.fileUrl),
  }));

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Drawings"
        description="Keep current revisions linked to the scheduled work they affect."
      />

      <div className="mt-6">
        <DrawingList projectId={projectId} drawings={securedDrawings} tasks={tasks} canUpload={canManageSchedule(role)} />
      </div>
    </div>
  );
}
