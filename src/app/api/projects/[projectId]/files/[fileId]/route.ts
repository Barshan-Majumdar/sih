import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/permissions";
import { deleteStoredFile } from "@/lib/storage";
import { requireActiveOrganization, requireUser } from "@/lib/session";
import { activityChanges, logActivity } from "@/lib/activity-log";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  const { projectId, fileId } = await params;
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const role = await requireProjectMember(user.id, projectId).catch(() => null);
  if (!role) {
    return Response.json({ error: "Project not found or unavailable." }, { status: 404 });
  }
  const document = await prisma.assistantAttachment.findFirst({
    where: {
      id: fileId,
      projectId,
      source: "DIRECT_UPLOAD",
      project: { organizationId },
    },
    select: {
      id: true,
      uploadedById: true,
      storageKey: true,
      searchableStorageKey: true,
      fileName: true,
      mediaType: true,
      sizeBytes: true,
      extractionStatus: true,
    },
  });
  if (!document) {
    return Response.json({ error: "File not found or unavailable." }, { status: 404 });
  }
  if (document.uploadedById !== user.id && role !== "PROJECT_MANAGER") {
    return Response.json({ error: "You cannot delete this project file." }, { status: 403 });
  }

  await deleteStoredFile(document.storageKey).catch(() => undefined);
  if (document.searchableStorageKey) {
    await deleteStoredFile(document.searchableStorageKey).catch(() => undefined);
  }
  await prisma.assistantAttachment.delete({ where: { id: document.id } });
  await logActivity({
    projectId,
    userId: user.id,
    action: "project_file_deleted",
    detail: `Deleted project file "${document.fileName}"`,
    entityType: "PROJECT_FILE",
    entityId: document.id,
    changes: activityChanges(document, {}, [
      "fileName",
      "mediaType",
      "sizeBytes",
      "extractionStatus",
    ]),
  });
  return new Response(null, { status: 204 });
}
