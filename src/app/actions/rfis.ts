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
import { notifyUser } from "@/lib/notifications";
import { ok, fail, type ActionResult } from "./schemas";
import type { RFI } from "@prisma/client";

const createRfiSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  taskId: z.string().cuid().optional().nullable(),
  attachmentId: z.string().cuid().optional().nullable(),
  pageNumber: z.number().int().min(1).optional().nullable(),
  citationExcerpt: z.string().trim().max(1000).optional().nullable(),
  question: z.string().min(1, "Question is required").max(1000),
  dueDate: z.coerce.date().optional().nullable(),
});

export async function createRfi(input: unknown): Promise<ActionResult<RFI>> {
  const parsed = createRfiSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireProjectMember(user.id, parsed.data.projectId);
    if (parsed.data.taskId) {
      await requireProjectTaskReference(parsed.data.projectId, parsed.data.taskId);
    }

    const raiser = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: parsed.data.projectId, userId: user.id } },
    });

    const attachmentId: string | null = parsed.data.attachmentId ?? null;
    let pageNumber: number | null = parsed.data.pageNumber ?? null;
    let citationExcerpt: string | null = parsed.data.citationExcerpt?.trim() || null;
    if (attachmentId) {
      const attachment = await prisma.assistantAttachment.findFirst({
        where: { id: attachmentId, projectId: parsed.data.projectId },
        select: { id: true, fileName: true },
      });
      if (!attachment) throw new Error("Project file not found");
      if (pageNumber !== null && !citationExcerpt) {
        const chunk = await prisma.documentChunk.findFirst({
          where: { documentId: attachment.id, pageNumber },
          orderBy: { chunkIndex: "asc" },
          select: { text: true },
        });
        citationExcerpt = chunk?.text.slice(0, 500) ?? null;
      }
    } else {
      pageNumber = null;
      citationExcerpt = null;
    }

    const rfi = await prisma.rFI.create({
      data: {
        projectId: parsed.data.projectId,
        taskId: parsed.data.taskId ?? null,
        attachmentId,
        pageNumber,
        citationExcerpt,
        question: parsed.data.question,
        dueDate: parsed.data.dueDate ?? null,
        raisedById: raiser.id,
      },
    });

    await logActivity({
      projectId: parsed.data.projectId,
      taskId: parsed.data.taskId ?? null,
      userId: user.id,
      action: "rfi_raised",
      detail: `Raised an RFI: ${parsed.data.question}`,
      entityType: "RFI",
      entityId: rfi.id,
      changes: activityChanges({}, rfi, ["question", "dueDate", "taskId", "status"]),
    });

    revalidatePath(`/projects/${parsed.data.projectId}/rfis`);
    return ok(rfi);
  } catch (error) {
    return fail(error);
  }
}

const answerRfiSchema = z.object({
  rfiId: z.string().min(1, "rfiId is required"),
  answer: z.string().min(1, "Please provide an answer").max(2000),
});

/** Only GC-side roles (PM/Scheduler/Superintendent) may answer an RFI. */
export async function answerRfi(input: unknown): Promise<ActionResult<RFI>> {
  const parsed = answerRfiSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.rFI.findUnique({ where: { id: parsed.data.rfiId } });
    if (!existing) throw new Error("RFI not found");

    await requireScheduleEditAccess(user.id, existing.projectId);

    const rfi = await prisma.rFI.update({
      where: { id: parsed.data.rfiId },
      data: { answer: parsed.data.answer, status: "ANSWERED" },
    });

    await logActivity({
      projectId: existing.projectId,
      taskId: existing.taskId,
      userId: user.id,
      action: "rfi_answered",
      detail: `Answered RFI: ${existing.question}`,
      entityType: "RFI",
      entityId: rfi.id,
      changes: activityChanges(existing, rfi, ["answer", "status"]),
    });

    const raiser = await prisma.projectMember.findUnique({
      where: { id: existing.raisedById },
      select: { userId: true },
    });
    if (raiser) {
      await notifyUser({
        userId: raiser.userId,
        actorUserId: user.id,
        subject: "Your RFI was answered",
        heading: "Your RFI has an answer",
        bodyLines: [`Question: "${existing.question}"`, `Answer: ${parsed.data.answer}`],
        path: `/projects/${existing.projectId}/rfis`,
      });
    }

    revalidatePath(`/projects/${existing.projectId}/rfis`);
    return ok(rfi);
  } catch (error) {
    return fail(error);
  }
}

const closeRfiSchema = z.object({ rfiId: z.string().min(1, "rfiId is required") });

export async function closeRfi(input: unknown): Promise<ActionResult<RFI>> {
  const parsed = closeRfiSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.rFI.findUnique({ where: { id: parsed.data.rfiId } });
    if (!existing) throw new Error("RFI not found");

    await requireScheduleEditAccess(user.id, existing.projectId);

    const rfi = await prisma.rFI.update({
      where: { id: parsed.data.rfiId },
      data: { status: "CLOSED" },
    });

    await logActivity({
      projectId: existing.projectId,
      taskId: existing.taskId,
      userId: user.id,
      action: "rfi_closed",
      detail: `Closed RFI: ${existing.question}`,
      entityType: "RFI",
      entityId: rfi.id,
      changes: activityChanges(existing, rfi, ["status"]),
    });

    revalidatePath(`/projects/${existing.projectId}/rfis`);
    return ok(rfi);
  } catch (error) {
    return fail(error);
  }
}
