import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { isProjectManager } from "@/lib/permissions";
import { InviteLinkGenerator } from "@/components/InviteLinkGenerator";
import { ProjectMembersTable } from "@/components/ProjectMembersTable";
import { Card } from "@/components/ui/Card";
import { ProjectPageHeader } from "@/components/PageHeader";

export default async function ProjectMembersPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, role } = await getProjectPageContext(projectId);

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const canManage = isProjectManager(role);

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Project Team"
        description="Manage project access, responsibilities, and field collaboration roles."
      />

      <div className="mt-6 space-y-6">
        {canManage && <InviteLinkGenerator projectId={projectId} firstInvite={members.length === 1} />}

        <Card className="p-6">
          <ProjectMembersTable projectId={projectId} members={members} canManage={canManage} />
        </Card>
      </div>
    </div>
  );
}
