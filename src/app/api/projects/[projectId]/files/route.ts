import { prisma } from "@/lib/prisma";
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

async function handlePost(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId,
      members: { some: { userId: user.id } },
    },
    select: { id: true },
  });
  if (!project) {
    return Response.json({ error: "Project not found or unavailable." }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  let upload: Awaited<ReturnType<typeof validateUploadedFile>>;
  try {
    upload = await validateUploadedFile(file, "document");
    await enforceUploadQuota({ organizationId, projectId, upload });
  } catch (error) {
    if (error instanceof UploadPolicyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const fileName = upload.fileName;
  const storageKey = buildStorageKey(`documents/${projectId}/files`, fileName);
  try {
    const fileUrl = await uploadFile(storageKey, upload.bytes, upload.mediaType);
    try {
      const document = await prisma.assistantAttachment.create({
        data: {
          projectId,
          uploadedById: user.id,
          fileName,
          mediaType: upload.mediaType,
          sizeBytes: upload.sizeBytes,
          contentHash: upload.contentHash,
          storageKey,
          fileUrl,
          source: "DIRECT_UPLOAD",
          extractionStatus: "PENDING",
        },
      });
      const processed = await processProjectDocument(document, upload.bytes);
      await logActivity({
        projectId,
        userId: user.id,
        action: "project_file_uploaded",
        detail: `Uploaded project file "${processed.fileName}"`,
        entityType: "PROJECT_FILE",
        entityId: processed.id,
        changes: activityChanges({}, processed, [
          "fileName",
          "mediaType",
          "sizeBytes",
          "source",
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
    reportException(error, "project.file.upload.failed", { projectId });
    return Response.json({ error: "The project file could not be uploaded." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  return observeApiRequest(request, "project.file.upload", () => handlePost(request, context));
}
