"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireCommitAccess, requireCommitmentRemovalAccess } from "@/lib/permissions";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { COMMITMENT_STATUS_LABELS, getWeekStart } from "@/lib/utils";
import { commitmentRemovalError } from "@/lib/weekly-commitments";
import { ok, fail, commitmentStatusSchema, type ActionResult } from "./schemas";
import type { WeeklyCommitment } from "@prisma/client";

const commitToWeekSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  weekStartDate: z.coerce.date({ message: "A valid week start date is required" }),
});

export async function commitToWeek(input: unknown): Promise<ActionResult<WeeklyCommitment>> {
  const parsed = commitToWeekSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const task = await requireCommitAccess(user.id, parsed.data.taskId);
    const weekStartDate = getWeekStart(parsed.data.weekStartDate);

    const committer = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: task.projectId, userId: user.id } },
    });

    const existing = await prisma.weeklyCommitment.findUnique({
      where: { taskId_weekStartDate: { taskId: parsed.data.taskId, weekStartDate } },
    });
    if (existing && !existing.removedAt) throw new Error("This task is already committed for that week");

    const commitment = existing
      ? await prisma.weeklyCommitment.update({
          where: { id: existing.id },
          data: {
            committedById: committer.id,
            status: "COMMITTED",
            reasonForVariance: null,
            removedAt: null,
            removedById: null,
            removalReason: null,
          },
        })
      : await prisma.weeklyCommitment.create({
          data: {
            taskId: parsed.data.taskId,
            weekStartDate,
            committedById: committer.id,
          },
        });

    await logActivity({
      projectId: task.projectId,
      taskId: task.id,
      taskName: task.name,
      userId: user.id,
      action: existing ? "commitment_restored" : "commitment_made",
      detail: `${existing ? "Restored" : "Committed"} "${task.name}" for the week of ${weekStartDate.toDateString()}`,
      entityType: "WEEKLY_COMMITMENT",
      entityId: commitment.id,
      changes: activityChanges(existing ?? {}, commitment, [
        "taskId",
        "weekStartDate",
        "committedById",
        "status",
        "removedAt",
      ]),
    });

    revalidatePath(`/projects/${task.projectId}/weekly-plan`);
    return ok(commitment);
  } catch (error) {
    return fail(error);
  }
}

const updateCommitmentStatusSchema = z
  .object({
    commitmentId: z.string().min(1, "commitmentId is required"),
    status: commitmentStatusSchema,
    reasonForVariance: z.string().max(500, "Keep the reason under 500 characters").optional().nullable(),
  })
  .refine((data) => data.status !== "NOT_COMPLETED" || !!data.reasonForVariance?.trim(), {
    message: "Please give a reason for variance when marking a commitment not completed",
    path: ["reasonForVariance"],
  });

export async function updateCommitmentStatus(input: unknown): Promise<ActionResult<WeeklyCommitment>> {
  const parsed = updateCommitmentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.weeklyCommitment.findUnique({
      where: { id: parsed.data.commitmentId },
      include: { task: true },
    });
    if (!existing) throw new Error("Commitment not found");
    if (existing.removedAt) throw new Error("Removed commitments must be recommitted from the weekly plan");

    await requireCommitAccess(user.id, existing.taskId);

    const commitment = await prisma.weeklyCommitment.update({
      where: { id: parsed.data.commitmentId },
      data: {
        status: parsed.data.status,
        reasonForVariance: parsed.data.status === "NOT_COMPLETED" ? parsed.data.reasonForVariance : null,
      },
    });

    await logActivity({
      projectId: existing.task.projectId,
      taskId: existing.task.id,
      taskName: existing.task.name,
      userId: user.id,
      action: "commitment_status_changed",
      detail: `Commitment on "${existing.task.name}" marked ${COMMITMENT_STATUS_LABELS[parsed.data.status]}${
        parsed.data.reasonForVariance ? ` — ${parsed.data.reasonForVariance}` : ""
      }`,
      entityType: "WEEKLY_COMMITMENT",
      entityId: commitment.id,
      changes: activityChanges(existing, commitment, ["status", "reasonForVariance"]),
    });

    revalidatePath(`/projects/${existing.task.projectId}/weekly-plan`);
    return ok(commitment);
  } catch (error) {
    return fail(error);
  }
}

const removeFutureCommitmentSchema = z.object({
  commitmentId: z.string().min(1, "commitmentId is required"),
  reason: z.string().trim().max(500, "Keep the reason under 500 characters").optional(),
});

export async function removeFutureCommitment(input: unknown): Promise<ActionResult<WeeklyCommitment>> {
  const parsed = removeFutureCommitmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await requireCommitmentRemovalAccess(user.id, parsed.data.commitmentId);
    const policyError = commitmentRemovalError(existing);
    if (policyError) throw new Error(policyError);

    const removedAt = new Date();
    const reason = parsed.data.reason || "Removed before the committed week began";
    const commitment = await prisma.$transaction(async (tx) => {
      const claimed = await tx.weeklyCommitment.updateMany({
        where: {
          id: existing.id,
          status: "COMMITTED",
          removedAt: null,
          weekStartDate: { gt: getWeekStart(removedAt) },
        },
        data: { removedAt, removedById: user.id, removalReason: reason },
      });
      if (claimed.count !== 1) {
        throw new Error("This commitment can no longer be removed. Refresh the weekly plan and try again.");
      }

      await tx.activityLogEntry.create({
        data: {
          projectId: existing.task.projectId,
          taskId: existing.task.id,
          taskName: existing.task.name,
          userId: user.id,
          action: "commitment_removed",
          detail: `Removed "${existing.task.name}" from the week of ${existing.weekStartDate.toDateString()}: ${reason}`,
          entityType: "WEEKLY_COMMITMENT",
          entityId: existing.id,
          source: "UI",
          changes: {
            removedAt: { before: null, after: removedAt.toISOString() },
            removalReason: { before: existing.removalReason, after: reason },
          },
        },
      });
      return tx.weeklyCommitment.findUniqueOrThrow({ where: { id: existing.id } });
    });

    revalidatePath(`/projects/${existing.task.projectId}/weekly-plan`);
    revalidatePath(`/projects/${existing.task.projectId}/dashboard`);
    return ok(commitment);
  } catch (error) {
    return fail(error);
  }
}
