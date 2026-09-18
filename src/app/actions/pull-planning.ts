"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireProjectMember, requireScheduleEditAccess } from "@/lib/permissions";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { ok, fail, type ActionResult } from "./schemas";
import type { Task } from "@prisma/client";

const addPullPlanTaskSchema = z
  .object({
    projectId: z.string().min(1, "projectId is required"),
    name: z.string().min(1, "Task name is required").max(200),
    startDate: z.coerce.date({ message: "A valid start date is required" }),
    endDate: z.coerce.date({ message: "A valid end date is required" }),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

/**
 * Pull Planning: any project member (including a Trade partner) can add their
 * own task to the board, self-assigned. This deliberately bypasses
 * requireScheduleEditAccess — that's the point of a pull-planning session.
 */
export async function addPullPlanTask(input: unknown): Promise<ActionResult<Task>> {
  const parsed = addPullPlanTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireProjectMember(user.id, parsed.data.projectId);

    const member = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: parsed.data.projectId, userId: user.id } },
    });

    const maxSeq = await prisma.task.aggregate({
      where: { projectId: parsed.data.projectId },
      _max: { sequenceOrder: true },
    });

    const task = await prisma.task.create({
      data: {
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        assignedToId: member.id,
        sequenceOrder: (maxSeq._max.sequenceOrder ?? 0) + 1,
      },
    });

    await logActivity({
      projectId: parsed.data.projectId,
      taskId: task.id,
      taskName: task.name,
      userId: user.id,
      action: "pull_plan_task_added",
      detail: `Added "${task.name}" to the pull-planning board`,
      entityType: "TASK",
      entityId: task.id,
      changes: activityChanges({}, task, [
        "name",
        "startDate",
        "endDate",
        "assignedToId",
        "sequenceOrder",
      ]),
    });

    revalidatePath(`/projects/${parsed.data.projectId}/pull-planning`);
    revalidatePath(`/projects/${parsed.data.projectId}`);
    revalidatePath(`/projects/${parsed.data.projectId}/gantt`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const reorderSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  orderedTaskIds: z.array(z.string()).min(1),
});

/**
 * Persists a new sequence order for the pull-planning board. The Superintendent
 * (or PM/Scheduler) running the session sequences the work; contributors don't.
 */
export async function reorderPullPlanTasks(input: unknown): Promise<ActionResult<null>> {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireScheduleEditAccess(user.id, parsed.data.projectId);

    const tasks = await prisma.task.findMany({
      where: { id: { in: parsed.data.orderedTaskIds }, projectId: parsed.data.projectId },
      select: { id: true },
    });
    if (tasks.length !== parsed.data.orderedTaskIds.length) {
      throw new Error("Task list is out of date — please refresh");
    }

    await prisma.$transaction(
      parsed.data.orderedTaskIds.map((id, index) =>
        prisma.task.update({ where: { id }, data: { sequenceOrder: index } })
      )
    );

    await logActivity({
      projectId: parsed.data.projectId,
      userId: user.id,
      action: "pull_plan_reordered",
      detail: `Reordered ${parsed.data.orderedTaskIds.length} tasks on the pull-planning board`,
      entityType: "PULL_PLAN",
      entityId: parsed.data.projectId,
      changes: {
        taskOrder: {
          before: tasks.map((task) => task.id).join(","),
          after: parsed.data.orderedTaskIds.join(","),
        },
      },
    });

    revalidatePath(`/projects/${parsed.data.projectId}/pull-planning`);
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
