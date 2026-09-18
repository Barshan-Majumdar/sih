"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  requireProjectMember,
  requireProjectTaskReference,
  requireScheduleEditAccess,
} from "@/lib/permissions";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { ok, fail, submittalStatusSchema, type ActionResult } from "./schemas";
import { SUBMITTAL_STATUS_LABELS } from "@/lib/utils";
import type { Submittal } from "@prisma/client";

const createSubmittalSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  taskId: z.string().cuid().optional().nullable(),
  title: z.string().min(1, "Title is required").max(200),
  specSection: z.string().max(50).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export async function createSubmittal(input: unknown): Promise<ActionResult<Submittal>> {
  const parsed = createSubmittalSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireProjectMember(user.id, parsed.data.projectId);
    if (parsed.data.taskId) {
      await requireProjectTaskReference(parsed.data.projectId, parsed.data.taskId);
    }

    const submitter = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: parsed.data.projectId, userId: user.id } },
    });

    const submittal = await prisma.submittal.create({
      data: {
        projectId: parsed.data.projectId,
        taskId: parsed.data.taskId ?? null,
        title: parsed.data.title,
        specSection: parsed.data.specSection ?? null,
        dueDate: parsed.data.dueDate ?? null,
        submittedById: submitter.id,
      },
    });

    await logActivity({
      projectId: parsed.data.projectId,
      taskId: parsed.data.taskId ?? null,
      userId: user.id,
      action: "submittal_created",
      detail: `Submitted "${submittal.title}" for review`,
      entityType: "SUBMITTAL",
      entityId: submittal.id,
      changes: activityChanges({}, submittal, ["title", "specSection", "dueDate", "taskId", "status"]),
    });

    revalidatePath(`/projects/${parsed.data.projectId}/submittals`);
    return ok(submittal);
  } catch (error) {
    return fail(error);
  }
}

const updateSubmittalStatusSchema = z.object({
  submittalId: z.string().min(1, "submittalId is required"),
  status: submittalStatusSchema,
});

/** Only GC-side roles (PM/Scheduler/Superintendent) can decide a submittal's status. */
export async function updateSubmittalStatus(input: unknown): Promise<ActionResult<Submittal>> {
  const parsed = updateSubmittalStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.submittal.findUnique({ where: { id: parsed.data.submittalId } });
    if (!existing) throw new Error("Submittal not found");

    await requireScheduleEditAccess(user.id, existing.projectId);

    const submittal = await prisma.submittal.update({
      where: { id: parsed.data.submittalId },
      data: { status: parsed.data.status },
    });

    await logActivity({
      projectId: existing.projectId,
      taskId: existing.taskId,
      userId: user.id,
      action: "submittal_status_changed",
      detail: `"${existing.title}" marked ${SUBMITTAL_STATUS_LABELS[parsed.data.status]}`,
      entityType: "SUBMITTAL",
      entityId: submittal.id,
      changes: activityChanges(existing, submittal, ["status"]),
    });

    revalidatePath(`/projects/${existing.projectId}/submittals`);
    return ok(submittal);
  } catch (error) {
    return fail(error);
  }
}
