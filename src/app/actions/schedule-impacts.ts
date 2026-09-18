"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  requireProjectMember,
  requireProjectTaskReference,
  canResolveRoadblocks,
} from "@/lib/permissions";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { notifyUser } from "@/lib/notifications";
import { ok, fail, sirStatusSchema, type ActionResult } from "./schemas";
import type { ScheduleImpactRequest } from "@prisma/client";

const createSirSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  taskId: z.string().cuid().optional().nullable(),
  description: z.string().min(1, "Please describe the field condition").max(1000, "Keep it under 1000 characters"),
  proposedNewEndDate: z.coerce.date().optional().nullable(),
});

export async function createScheduleImpactRequest(input: unknown): Promise<ActionResult<ScheduleImpactRequest>> {
  const parsed = createSirSchema.safeParse(input);
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

    const sir = await prisma.scheduleImpactRequest.create({
      data: {
        projectId: parsed.data.projectId,
        taskId: parsed.data.taskId ?? null,
        description: parsed.data.description,
        proposedNewEndDate: parsed.data.proposedNewEndDate ?? null,
        submittedById: submitter.id,
      },
    });

    await logActivity({
      projectId: parsed.data.projectId,
      taskId: parsed.data.taskId ?? null,
      userId: user.id,
      action: "sir_submitted",
      detail: `Submitted a Schedule Impact Request: ${parsed.data.description}`,
      entityType: "SCHEDULE_IMPACT_REQUEST",
      entityId: sir.id,
      changes: activityChanges({}, sir, ["description", "proposedNewEndDate", "taskId", "status"]),
    });

    revalidatePath(`/projects/${parsed.data.projectId}/impacts`);
    return ok(sir);
  } catch (error) {
    return fail(error);
  }
}

const reviewSirSchema = z.object({
  sirId: z.string().min(1, "sirId is required"),
  status: sirStatusSchema.refine((s) => s !== "PENDING", { message: "Choose Approved or Rejected" }),
  reviewNote: z.string().max(1000, "Keep the note under 1000 characters").optional().nullable(),
});

/** Only a Project Manager or Superintendent may review a Schedule Impact Request. */
export async function reviewScheduleImpactRequest(input: unknown): Promise<ActionResult<ScheduleImpactRequest>> {
  const parsed = reviewSirSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.scheduleImpactRequest.findUnique({ where: { id: parsed.data.sirId } });
    if (!existing) throw new Error("Schedule Impact Request not found");

    const role = await requireProjectMember(user.id, existing.projectId);
    if (!canResolveRoadblocks(role)) {
      throw new Error("Only a Project Manager or Superintendent can review this request");
    }

    const reviewer = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: existing.projectId, userId: user.id } },
    });

    const sir = await prisma.scheduleImpactRequest.update({
      where: { id: parsed.data.sirId },
      data: {
        status: parsed.data.status,
        reviewNote: parsed.data.reviewNote ?? null,
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
      },
    });

    // An approved SIR that proposed a new end date pushes the linked task out.
    if (parsed.data.status === "APPROVED" && existing.taskId && existing.proposedNewEndDate) {
      await requireProjectTaskReference(existing.projectId, existing.taskId);
      await prisma.task.update({
        where: { id: existing.taskId },
        data: { endDate: existing.proposedNewEndDate },
      });
    }

    await logActivity({
      projectId: existing.projectId,
      taskId: existing.taskId,
      userId: user.id,
      action: "sir_reviewed",
      detail: `${parsed.data.status === "APPROVED" ? "Approved" : "Rejected"} a Schedule Impact Request${
        parsed.data.reviewNote ? `: ${parsed.data.reviewNote}` : ""
      }`,
      entityType: "SCHEDULE_IMPACT_REQUEST",
      entityId: sir.id,
      changes: activityChanges(existing, sir, ["status", "reviewNote", "reviewedById", "reviewedAt"]),
    });

    const submitter = await prisma.projectMember.findUnique({
      where: { id: existing.submittedById },
      select: { userId: true },
    });
    if (submitter) {
      const outcome = parsed.data.status === "APPROVED" ? "approved" : "rejected";
      await notifyUser({
        userId: submitter.userId,
        actorUserId: user.id,
        subject: `Your schedule impact request was ${outcome}`,
        heading: `Schedule Impact Request ${outcome}`,
        bodyLines: [
          `Your request — "${existing.description}" — was <strong>${outcome}</strong>.`,
          parsed.data.reviewNote ? `Reviewer note: ${parsed.data.reviewNote}` : "",
        ].filter(Boolean),
        path: `/projects/${existing.projectId}/impacts`,
      });
    }

    revalidatePath(`/projects/${existing.projectId}/impacts`);
    return ok(sir);
  } catch (error) {
    return fail(error);
  }
}
