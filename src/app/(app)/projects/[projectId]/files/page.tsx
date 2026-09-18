import { ProjectFilesBrowser, type ProjectFileRecord } from "@/components/ProjectFilesBrowser";
import { ProjectPageHeader } from "@/components/PageHeader";
import { getProjectPageContext } from "@/lib/project-context";
import { prisma } from "@/lib/prisma";
import { privateStoredFileUrl } from "@/lib/storage";

function fileNameFromUrl(url: string, fallback: string): string {
  try {
    const path = url.split("?")[0];
    const encodedName = path.split("/").at(-1);
    if (!encodedName) return fallback;
    return decodeURIComponent(encodedName).replace(/^\d+-/, "") || fallback;
  } catch {
    return fallback;
  }
}

function mediaTypeFromName(fileName: string, imageFallback = false): string {
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return imageFallback ? "image/unknown" : "application/octet-stream";
}

function dateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ProjectFilesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project, user, role } = await getProjectPageContext(projectId);
  const [attachments, drawings, fieldUpdates] = await Promise.all([
    prisma.assistantAttachment.findMany({
      where: {
        projectId,
        OR: [{ source: "DIRECT_UPLOAD" }, { source: "AI_UPLOAD", messageId: { not: null } }],
      },
      include: {
        uploadedBy: { select: { name: true } },
        conversation: { select: { id: true, title: true, createdById: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.drawing.findMany({
      where: { projectId },
      include: {
        uploadedBy: { include: { user: { select: { name: true } } } },
        task: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.taskUpdate.findMany({
      where: { photoUrl: { not: null }, task: { projectId } },
      include: {
        author: { select: { name: true } },
        task: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const files: ProjectFileRecord[] = [
    ...attachments.map((attachment) => ({
      id: attachment.id,
      kind: attachment.source === "DIRECT_UPLOAD" ? ("PROJECT_DOCUMENT" as const) : ("AI_UPLOAD" as const),
      name: attachment.fileName,
      originalFileName: attachment.fileName,
      mediaType: attachment.mediaType,
      url: privateStoredFileUrl(attachment.fileUrl),
      viewerUrl: privateStoredFileUrl(attachment.searchableFileUrl ?? attachment.fileUrl),
      sizeBytes: attachment.sizeBytes,
      uploadedBy: attachment.uploadedBy.name,
      uploadedAt: attachment.createdAt.toISOString(),
      uploadedAtLabel: dateLabel(attachment.createdAt),
      sourceLabel:
        attachment.source === "DIRECT_UPLOAD"
          ? "Files workspace"
          : attachment.conversation?.createdById === user.id
            ? attachment.conversation.title
            : attachment.conversation
              ? "Private AI conversation"
              : "Saved AI upload",
      sourceHref: null,
      sourceActionLabel:
        attachment.conversation?.createdById === user.id ? "Open chat" : "Private conversation",
      conversationId:
        attachment.conversation?.createdById === user.id ? attachment.conversation.id : null,
      detail: null,
      extractionStatus: attachment.extractionStatus,
      extractionError: attachment.extractionError,
      canDelete:
        attachment.source === "DIRECT_UPLOAD" &&
        (attachment.uploadedById === user.id || role === "PROJECT_MANAGER"),
    })),
    ...drawings.map((drawing) => {
      const originalFileName = fileNameFromUrl(drawing.fileUrl, drawing.title);
      return {
        id: drawing.id,
        kind: "DRAWING" as const,
        name: drawing.title,
        originalFileName,
        mediaType: mediaTypeFromName(originalFileName),
        url: privateStoredFileUrl(drawing.fileUrl),
        sizeBytes: null,
        uploadedBy: drawing.uploadedBy.user.name,
        uploadedAt: drawing.createdAt.toISOString(),
        uploadedAtLabel: dateLabel(drawing.createdAt),
        sourceLabel: drawing.task?.name ?? "Drawings register",
        sourceHref: `/projects/${projectId}/drawings`,
        sourceActionLabel: "View drawing",
        conversationId: null,
        detail: `Rev ${drawing.revision}${drawing.isSuperseded ? " - superseded" : ""}`,
        extractionStatus: null,
        extractionError: null,
        canDelete: false,
      };
    }),
    ...fieldUpdates.map((update) => {
      const photoUrl = update.photoUrl!;
      const originalFileName = fileNameFromUrl(photoUrl, `${update.task.name} photo`);
      return {
        id: update.id,
        kind: "FIELD_PHOTO" as const,
        name: originalFileName,
        originalFileName,
        mediaType: mediaTypeFromName(originalFileName, true),
        url: privateStoredFileUrl(photoUrl),
        sizeBytes: null,
        uploadedBy: update.author.name,
        uploadedAt: update.createdAt.toISOString(),
        uploadedAtLabel: dateLabel(update.createdAt),
        sourceLabel: update.task.name,
        sourceHref: `/projects/${projectId}/tasks/${update.task.id}`,
        sourceActionLabel: "View task",
        conversationId: null,
        detail: update.note?.trim() || null,
        extractionStatus: null,
        extractionError: null,
        canDelete: false,
      };
    }),
  ].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Files"
        description="Find every project attachment, drawing, and field photo in one place."
      />
      <div className="mt-6">
        <ProjectFilesBrowser projectId={projectId} files={files} />
      </div>
    </div>
  );
}
