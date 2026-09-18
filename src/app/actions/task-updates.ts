"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireProjectMember } from "@/lib/permissions";
import { uploadFile, buildStorageKey, deleteStoredFile } from "@/lib/storage";
import { enforceUploadQuota, validateUploadedFile } from "@/lib/file-uploads";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { ok, fail, type ActionResult } from "./schemas";
import type { TaskUpdate } from "@prisma/client";

const addTaskUpdateSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  note: z.string().max(1000, "Keep the note under 1000 characters").optional(),
});

/**
 * Field Tracking: log a progress note and/or photo against a task, from any
 * project member. Accepts FormData so it can carry an optional photo File.
 *
 * Photo storage goes through lib/storage.ts — S3-compatible object storage
 * when configured, local disk fallback in dev.
 */
export async function addTaskUpdate(formData: FormData): Promise<ActionResult<TaskUpdate>> {
  const parsed = addTaskUpdateSchema.safeParse({
    taskId: formData.get("taskId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;

  if (!parsed.data.note?.trim() && !hasPhoto) {
    return { success: false, error: "Add a note or a photo before posting an update" };
  }

  try {
    const user = await requireUser();
    const task = await prisma.task.findUnique({
      where: { id: parsed.data.taskId },
      include: { project: { select: { organizationId: true } } },
    });
    if (!task) throw new Error("Task not found");

    // Any project member can post a field update (view access is enough).
    await requireProjectMember(user.id, task.projectId);

    let photoUrl: string | null = null;
    let photoStorageKey: string | null = null;
    let validatedPhoto: Awaited<ReturnType<typeof validateUploadedFile>> | null = null;
    if (hasPhoto) {
      const file = photo as File;
      validatedPhoto = await validateUploadedFile(file, "photo");
      await enforceUploadQuota({
        organizationId: task.project.organizationId,
        projectId: task.projectId,
        upload: validatedPhoto,
      });
      photoStorageKey = buildStorageKey(`tasks/${task.id}`, validatedPhoto.fileName);
      photoUrl = await uploadFile(
        photoStorageKey,
        validatedPhoto.bytes,
        validatedPhoto.mediaType
      );
    }

    let update: TaskUpdate;
    try {
      update = await prisma.taskUpdate.create({
        data: {
          taskId: task.id,
          authorId: user.id,
          note: parsed.data.note?.trim() || null,
          photoUrl,
          storageKey: photoStorageKey,
          fileName: validatedPhoto?.fileName,
          mediaType: validatedPhoto?.mediaType,
          sizeBytes: validatedPhoto?.sizeBytes,
          contentHash: validatedPhoto?.contentHash,
        },
      });
    } catch (error) {
      if (photoStorageKey) await deleteStoredFile(photoStorageKey).catch(() => undefined);
      throw error;
    }

    await logActivity({
      projectId: task.projectId,
      taskId: task.id,
      taskName: task.name,
      userId: user.id,
      action: "task_update_added",
      detail: `Posted a field update on "${task.name}"${validatedPhoto ? " with a photo" : ""}`,
      entityType: "TASK_UPDATE",
      entityId: update.id,
      changes: activityChanges({}, update, ["note", "fileName"]),
    });

    revalidatePath(`/projects/${task.projectId}/tasks/${task.id}`);
    return ok(update);
  } catch (error) {
    return fail(error);
  }
}
