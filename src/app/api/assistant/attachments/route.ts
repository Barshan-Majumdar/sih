import { prisma } from "@/lib/prisma";
import {
  MAX_ASSISTANT_ATTACHMENTS,
} from "@/lib/assistant-attachments";
import { requireAssistantConversation } from "@/lib/assistant-conversations";
import { processProjectDocument } from "@/lib/document-extraction";
import { buildStorageKey, deleteStoredFile, uploadFile } from "@/lib/storage";
import { requireActiveOrganization, requireUser } from "@/lib/session";
import {
  enforceUploadQuota,
  UploadPolicyError,
  validateUploadedFile,
} from "@/lib/file-uploads";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { observeApiRequest, reportException } from "@/lib/observability";

export const runtime = "nodejs";

async function handlePost(request: Request) {
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const formData = await request.formData().catch(() => null);
  const conversationId = formData?.get("conversationId");
  const file = formData?.get("file");

  if (typeof conversationId !== "string" || !(file instanceof File)) {
    return Response.json({ error: "Choose a file to attach." }, { status: 400 });
  }
  const conversation = await requireAssistantConversation(conversationId, user.id, organizationId);
  if (!conversation.projectId) {
    return Response.json(
      { error: "Choose a project conversation before attaching files." },
      { status: 400 }
    );
  }

  const pendingCount = await prisma.assistantAttachment.count({
    where: { conversationId, uploadedById: user.id, messageId: null },
  });
  if (pendingCount >= MAX_ASSISTANT_ATTACHMENTS * 2) {
    return Response.json(
      { error: "Remove an unused attachment before uploading another." },
      { status: 409 }
    );
  }

  let upload: Awaited<ReturnType<typeof validateUploadedFile>>;
  try {
    upload = await validateUploadedFile(file, "document");
    await enforceUploadQuota({
      organizationId,
      projectId: conversation.projectId,
      upload,
    });
  } catch (error) {
    if (error instanceof UploadPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const fileName = upload.fileName;
  const storageKey = buildStorageKey(
    `documents/${conversation.projectId}/assistant/${conversation.id}`,
    fileName
  );

  try {
    const fileUrl = await uploadFile(storageKey, upload.bytes, upload.mediaType);
    try {
      const attachment = await prisma.assistantAttachment.create({
        data: {
          conversationId: conversation.id,
          projectId: conversation.projectId,
          uploadedById: user.id,
          fileName,
          mediaType: upload.mediaType,
          sizeBytes: upload.sizeBytes,
          contentHash: upload.contentHash,
          storageKey,
          fileUrl,
        },
      });
      const processed = await processProjectDocument(attachment, upload.bytes);
      await logActivity({
        projectId: conversation.projectId,
        userId: user.id,
        action: "assistant_file_uploaded",
        detail: `Attached project file "${processed.fileName}" in Agent`,
        entityType: "PROJECT_FILE",
        entityId: processed.id,
        source: "AGENT",
        changes: activityChanges({}, processed, [
          "fileName",
          "mediaType",
          "sizeBytes",
          "extractionStatus",
        ]),
      });
      return Response.json(
        {
          id: processed.id,
          fileName: processed.fileName,
          mediaType: processed.mediaType,
          sizeBytes: processed.sizeBytes,
          url: processed.fileUrl,
          viewerUrl: processed.searchableFileUrl ?? processed.fileUrl,
          extractionStatus: processed.extractionStatus,
          extractionError: processed.extractionError,
        },
        { status: 201 }
      );
    } catch (error) {
      await deleteStoredFile(storageKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    reportException(error, "assistant.attachment.upload.failed", { conversationId });
    return Response.json({ error: "The attachment could not be uploaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return observeApiRequest(request, "assistant.attachment.upload", () => handlePost(request));
}
