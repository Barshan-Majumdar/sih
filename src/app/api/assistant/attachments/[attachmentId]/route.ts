import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";
import { requireActiveOrganization, requireUser } from "@/lib/session";
import { activityChanges, logActivity } from "@/lib/activity-log";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const attachment = await prisma.assistantAttachment.findFirst({
    where: {
      id: attachmentId,
      uploadedById: user.id,
      messageId: null,
      conversation: { organizationId, createdById: user.id },
    },
    select: {
      id: true,
      projectId: true,
      storageKey: true,
      searchableStorageKey: true,
      fileName: true,
      mediaType: true,
      sizeBytes: true,
      extractionStatus: true,
    },
  });

  if (!attachment) {
    return Response.json({ error: "Attachment not found." }, { status: 404 });
  }

  await deleteStoredFile(attachment.storageKey).catch(() => undefined);
  if (attachment.searchableStorageKey) {
    await deleteStoredFile(attachment.searchableStorageKey).catch(() => undefined);
  }
  await prisma.assistantAttachment.delete({ where: { id: attachment.id } });
  await logActivity({
    projectId: attachment.projectId,
    userId: user.id,
    action: "assistant_file_removed",
    detail: `Removed Agent attachment "${attachment.fileName}"`,
    entityType: "PROJECT_FILE",
    entityId: attachment.id,
    source: "AGENT",
    changes: activityChanges(attachment, {}, [
      "fileName",
      "mediaType",
      "sizeBytes",
      "extractionStatus",
    ]),
  });
  return new Response(null, { status: 204 });
}
