"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireProjectTaskReference, requireScheduleEditAccess } from "@/lib/permissions";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { uploadFile, buildStorageKey, deleteStoredFile } from "@/lib/storage";
import { enforceUploadQuota, validateUploadedFile } from "@/lib/file-uploads";
import { ok, fail, type ActionResult } from "./schemas";
import type { Drawing } from "@prisma/client";

const uploadDrawingSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  taskId: z.string().cuid().optional().nullable(),
  title: z.string().min(1, "Title is required").max(200),
  discipline: z.string().max(50).optional().nullable(),
});

/**
 * Upload a drawing (PDF or image) via lib/storage.ts (S3-compatible storage
 * when configured, local disk fallback in dev). If a prior drawing with the
 * same title already exists on this project, it's marked superseded and the
 * new upload's revision number increments from it.
 */
export async function uploadDrawing(formData: FormData): Promise<ActionResult<Drawing>> {
  const parsed = uploadDrawingSchema.safeParse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId") || undefined,
    title: formData.get("title"),
    discipline: formData.get("discipline") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Please choose a file to upload" };
  }

  try {
    const user = await requireUser();
    await requireScheduleEditAccess(user.id, parsed.data.projectId);
    if (parsed.data.taskId) {
      await requireProjectTaskReference(parsed.data.projectId, parsed.data.taskId);
    }

    const uploader = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: parsed.data.projectId, userId: user.id } },
      include: { project: { select: { organizationId: true } } },
    });
    const validated = await validateUploadedFile(file, "drawing");
    await enforceUploadQuota({
      organizationId: uploader.project.organizationId,
      projectId: parsed.data.projectId,
      upload: validated,
    });

    const priorRevision = await prisma.drawing.findFirst({
      where: { projectId: parsed.data.projectId, title: parsed.data.title, isSuperseded: false },
      orderBy: { revision: "desc" },
    });

    const key = buildStorageKey(`drawings/${parsed.data.projectId}`, validated.fileName);
    const fileUrl = await uploadFile(key, validated.bytes, validated.mediaType);

    let drawing: Drawing;
    try {
      drawing = await prisma.$transaction(async (tx) => {
        if (priorRevision) {
          await tx.drawing.update({ where: { id: priorRevision.id }, data: { isSuperseded: true } });
        }
        return tx.drawing.create({
          data: {
            projectId: parsed.data.projectId,
            taskId: parsed.data.taskId ?? null,
            title: parsed.data.title,
            discipline: parsed.data.discipline ?? null,
            fileUrl,
            storageKey: key,
            fileName: validated.fileName,
            mediaType: validated.mediaType,
            sizeBytes: validated.sizeBytes,
            contentHash: validated.contentHash,
            revision: (priorRevision?.revision ?? 0) + 1,
            uploadedById: uploader.id,
          },
        });
      });
    } catch (error) {
      await deleteStoredFile(key).catch(() => undefined);
      throw error;
    }

    await logActivity({
      projectId: parsed.data.projectId,
      taskId: parsed.data.taskId ?? null,
      userId: user.id,
      action: "drawing_uploaded",
      detail: `Uploaded "${drawing.title}" (rev ${drawing.revision})${
        priorRevision ? ` — supersedes rev ${priorRevision.revision}` : ""
      }`,
      entityType: "DRAWING",
      entityId: drawing.id,
      changes: activityChanges({}, drawing, [
        "title",
        "discipline",
        "revision",
        "taskId",
        "fileName",
      ]),
    });

    revalidatePath(`/projects/${parsed.data.projectId}/drawings`);
    return ok(drawing);
  } catch (error) {
    return fail(error);
  }
}
