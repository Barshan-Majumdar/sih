import { redirect } from "next/navigation";
import { requireActiveOrganization } from "@/lib/session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Resolves the user's active project (from cookie preference or most recent active project)
 * and redirects to the clean URL: /${toolSegment}/${projectId}.
 * If no projects exist in the workspace, redirects to /projects/new.
 */
export async function redirectToActiveProjectTool(toolSegment: string, queryString?: string) {
  const { user, organizationId } = await requireActiveOrganization();
  const cookieStore = await cookies();
  const preferredId =
    cookieStore.get("infratrack_active_project")?.value ??
    cookieStore.get("agira_active_project")?.value;

  let projectId: string | null = null;

  if (preferredId && preferredId !== "new") {
    const exists = await prisma.project.findFirst({
      where: {
        id: preferredId,
        organizationId,
        isArchived: false,
        members: { some: { userId: user.id } },
      },
      select: { id: true },
    });
    if (exists) projectId = exists.id;
  }

  if (!projectId) {
    const first = await prisma.project.findFirst({
      where: {
        organizationId,
        isArchived: false,
        members: { some: { userId: user.id } },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (first) projectId = first.id;
  }

  if (!projectId) {
    redirect("/projects/new");
  }

  const query = queryString ? `?${queryString}` : "";
  redirect(`/${toolSegment}/${projectId}${query}`);
}
