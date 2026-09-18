"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  requireProjectMember,
  requireProjectMemberReference,
  requireProjectDependencyReference,
  requireScheduleEditAccess,
  requireTaskEditAccess,
  requireRoadblockResolveAccess,
} from "@/lib/permissions";
import { ok, fail, taskStatusSchema, roadblockTypeSchema, type ActionResult } from "./schemas";
import { wouldCreateCycle } from "@/lib/critical-path";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { notifyUser } from "@/lib/notifications";
import { TASK_STATUS_LABELS, formatDate } from "@/lib/utils";
import type { Task, TaskDependency } from "@prisma/client";

/** Emails a project member (by ProjectMember id) that a task/roadblock now involves them. */
async function notifyMember(params: {
  projectId: string;
  memberId: string;
  actorUserId: string;
  subject: string;
  heading: string;
  bodyLines: string[];
  path: string;
}) {
  const member = await prisma.projectMember.findFirst({
    where: { id: params.memberId, projectId: params.projectId },
    select: { userId: true },
  });
  if (!member) return;
  await notifyUser({
    userId: member.userId,
    actorUserId: params.actorUserId,
    subject: params.subject,
    heading: params.heading,
    bodyLines: params.bodyLines,
    path: params.path,
  });
}

const createTaskSchema = z
  .object({
    projectId: z.string().min(1, "projectId is required"),
    name: z.string().min(1, "Task name is required").max(200),
    assignedToId: z.string().cuid().optional().nullable(),
    startDate: z.coerce.date({ message: "A valid start date is required" }),
    endDate: z.coerce.date({ message: "A valid end date is required" }),
    status: taskStatusSchema.default("NOT_STARTED"),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export async function createTask(input: unknown): Promise<ActionResult<Task>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    // Project Manager, Scheduler, or Superintendent can create tasks.
    await requireScheduleEditAccess(user.id, parsed.data.projectId);
    if (parsed.data.assignedToId) {
      await requireProjectMemberReference(parsed.data.projectId, parsed.data.assignedToId);
    }

    const task = await prisma.task.create({
      data: {
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        assignedToId: parsed.data.assignedToId ?? null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        status: parsed.data.status,
        progress: parsed.data.status === "DONE" ? 100 : 0,
      },
    });

    await logActivity({
      projectId: parsed.data.projectId,
      taskId: task.id,
      taskName: task.name,
      userId: user.id,
      action: "task_created",
      detail: `Created task "${task.name}"`,
      entityType: "TASK",
      entityId: task.id,
      changes: activityChanges({}, task, [
        "name",
        "assignedToId",
        "startDate",
        "endDate",
        "status",
        "progress",
      ]),
    });

    if (task.assignedToId) {
      await notifyMember({
        projectId: parsed.data.projectId,
        memberId: task.assignedToId,
        actorUserId: user.id,
        subject: `New task assigned: ${task.name}`,
        heading: "You've been assigned a task",
        bodyLines: [
          `<strong>${task.name}</strong> was assigned to you.`,
          `Scheduled ${formatDate(task.startDate)} – ${formatDate(task.endDate)}.`,
        ],
        path: `/projects/${task.projectId}/tasks/${task.id}`,
      });
    }

    revalidatePath(`/projects/${parsed.data.projectId}`);
    revalidatePath(`/projects/${parsed.data.projectId}/gantt`);
    revalidatePath(`/projects/${parsed.data.projectId}/dashboard`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const updateTaskSchema = z
  .object({
    taskId: z.string().min(1, "taskId is required"),
    name: z.string().min(1, "Task name is required").max(200),
    assignedToId: z.string().cuid().optional().nullable(),
    startDate: z.coerce.date({ message: "A valid start date is required" }),
    endDate: z.coerce.date({ message: "A valid end date is required" }),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export async function updateTask(input: unknown): Promise<ActionResult<Task>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await requireTaskEditAccess(user.id, parsed.data.taskId);
    if (parsed.data.assignedToId) {
      await requireProjectMemberReference(existing.projectId, parsed.data.assignedToId);
    }

    const task = await prisma.task.update({
      where: { id: parsed.data.taskId },
      data: {
        name: parsed.data.name,
        assignedToId: parsed.data.assignedToId ?? null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      },
    });

    await logActivity({
      projectId: existing.projectId,
      taskId: task.id,
      taskName: task.name,
      userId: user.id,
      action: "task_updated",
      detail: `Updated dates/assignment for "${task.name}"`,
      entityType: "TASK",
      entityId: task.id,
      changes: activityChanges(existing, task, ["name", "assignedToId", "startDate", "endDate"]),
    });

    // Only notify on a genuinely new assignment, not every edit.
    if (task.assignedToId && task.assignedToId !== existing.assignedToId) {
      await notifyMember({
        projectId: existing.projectId,
        memberId: task.assignedToId,
        actorUserId: user.id,
        subject: `New task assigned: ${task.name}`,
        heading: "You've been assigned a task",
        bodyLines: [
          `<strong>${task.name}</strong> was assigned to you.`,
          `Scheduled ${formatDate(task.startDate)} – ${formatDate(task.endDate)}.`,
        ],
        path: `/projects/${existing.projectId}/tasks/${task.id}`,
      });
    }

    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/gantt`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const updateTaskDatesSchema = z
  .object({
    taskId: z.string().min(1, "taskId is required"),
    startDate: z.coerce.date({ message: "A valid start date is required" }),
    endDate: z.coerce.date({ message: "A valid end date is required" }),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

/**
 * Reschedule a task's dates only (used by the interactive Gantt drag). Unlike
 * updateTask this doesn't touch name/assignee, so a drag can never
 * accidentally unassign a task.
 */
export async function updateTaskDates(input: unknown): Promise<ActionResult<Task>> {
  const parsed = updateTaskDatesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
    if (!existing) throw new Error("Task not found");

    await requireScheduleEditAccess(user.id, existing.projectId);

    const task = await prisma.task.update({
      where: { id: parsed.data.taskId },
      data: { startDate: parsed.data.startDate, endDate: parsed.data.endDate },
    });

    await logActivity({
      projectId: existing.projectId,
      taskId: task.id,
      taskName: task.name,
      userId: user.id,
      action: "task_rescheduled",
      detail: `Rescheduled "${task.name}" to ${task.startDate.toDateString()} – ${task.endDate.toDateString()}`,
      entityType: "TASK",
      entityId: task.id,
      changes: activityChanges(existing, task, ["startDate", "endDate"]),
    });

    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/gantt`);
    revalidatePath(`/projects/${existing.projectId}/lookahead`);
    revalidatePath(`/projects/${existing.projectId}/dashboard`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const updateTaskStatusSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  status: taskStatusSchema,
});

export async function updateTaskStatus(input: unknown): Promise<ActionResult<Task>> {
  const parsed = updateTaskStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await requireTaskEditAccess(user.id, parsed.data.taskId);

    const task = await prisma.task.update({
      where: { id: parsed.data.taskId },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === "DONE" ? { progress: 100 } : {}),
        ...(parsed.data.status === "NOT_STARTED" ? { progress: 0 } : {}),
      },
    });

    await logActivity({
      projectId: existing.projectId,
      taskId: task.id,
      taskName: task.name,
      userId: user.id,
      action: "status_changed",
      detail: `Status changed from ${TASK_STATUS_LABELS[existing.status]} to ${TASK_STATUS_LABELS[task.status]} on "${task.name}"`,
      entityType: "TASK",
      entityId: task.id,
      changes: activityChanges(existing, task, ["status", "progress"]),
    });

    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/gantt`);
    revalidatePath(`/projects/${existing.projectId}/dashboard`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const flagRoadblockSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  roadblockNote: z
    .string()
    .min(1, "Please describe what's blocking this task")
    .max(500, "Keep the note under 500 characters"),
  roadblockType: roadblockTypeSchema.default("OTHER"),
  roadblockOwnerId: z.string().cuid().optional().nullable(),
  roadblockDueDate: z.coerce.date().optional().nullable(),
});

export async function flagRoadblock(input: unknown): Promise<ActionResult<Task>> {
  const parsed = flagRoadblockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
    if (!existing) throw new Error("Task not found");

    // Any project member can flag a roadblock (view access is enough).
    await requireProjectMember(user.id, existing.projectId);
    if (parsed.data.roadblockOwnerId) {
      await requireProjectMemberReference(existing.projectId, parsed.data.roadblockOwnerId);
    }

    const task = await prisma.task.update({
      where: { id: parsed.data.taskId },
      data: {
        isRoadblock: true,
        roadblockStatus: "OPEN",
        roadblockNote: parsed.data.roadblockNote,
        roadblockType: parsed.data.roadblockType,
        roadblockOwnerId: parsed.data.roadblockOwnerId ?? null,
        roadblockDueDate: parsed.data.roadblockDueDate ?? null,
        roadblockRaisedBy: user.id,
        resolvedAt: null,
      },
    });

    await logActivity({
      projectId: existing.projectId,
      taskId: task.id,
      taskName: task.name,
      userId: user.id,
      action: "roadblock_flagged",
      detail: `Flagged a roadblock on "${task.name}": ${parsed.data.roadblockNote}`,
      entityType: "TASK",
      entityId: task.id,
      changes: activityChanges(existing, task, [
        "isRoadblock",
        "roadblockStatus",
        "roadblockNote",
        "roadblockType",
        "roadblockOwnerId",
        "roadblockDueDate",
      ]),
    });

    if (task.roadblockOwnerId) {
      await notifyMember({
        projectId: existing.projectId,
        memberId: task.roadblockOwnerId,
        actorUserId: user.id,
        subject: `Roadblock assigned to you: ${task.name}`,
        heading: "A roadblock needs your attention",
        bodyLines: [
          `A roadblock on <strong>${task.name}</strong> was assigned to you.`,
          `Note: ${parsed.data.roadblockNote}`,
        ],
        path: `/projects/${existing.projectId}/roadblocks`,
      });
    }

    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/gantt`);
    revalidatePath(`/projects/${existing.projectId}/dashboard`);
    revalidatePath(`/projects/${existing.projectId}/roadblocks`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const updateRoadblockDetailsSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  roadblockType: roadblockTypeSchema,
  roadblockOwnerId: z.string().cuid().optional().nullable(),
  roadblockDueDate: z.coerce.date().optional().nullable(),
});

/** Reassign a roadblock's type/owner/due date — used from the Roadblock Log. */
export async function updateRoadblockDetails(input: unknown): Promise<ActionResult<Task>> {
  const parsed = updateRoadblockDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
    if (!existing) throw new Error("Task not found");

    await requireScheduleEditAccess(user.id, existing.projectId);
    if (parsed.data.roadblockOwnerId) {
      await requireProjectMemberReference(existing.projectId, parsed.data.roadblockOwnerId);
    }

    const task = await prisma.task.update({
      where: { id: parsed.data.taskId },
      data: {
        roadblockType: parsed.data.roadblockType,
        roadblockOwnerId: parsed.data.roadblockOwnerId ?? null,
        roadblockDueDate: parsed.data.roadblockDueDate ?? null,
      },
    });

    await logActivity({
      projectId: existing.projectId,
      taskId: task.id,
      taskName: task.name,
      userId: user.id,
      action: "roadblock_updated",
      detail: `Updated roadblock details for "${task.name}"`,
      entityType: "TASK",
      entityId: task.id,
      changes: activityChanges(existing, task, [
        "roadblockType",
        "roadblockOwnerId",
        "roadblockDueDate",
      ]),
    });

    if (task.roadblockOwnerId && task.roadblockOwnerId !== existing.roadblockOwnerId) {
      await notifyMember({
        projectId: existing.projectId,
        memberId: task.roadblockOwnerId,
        actorUserId: user.id,
        subject: `Roadblock assigned to you: ${task.name}`,
        heading: "A roadblock needs your attention",
        bodyLines: [
          `The roadblock on <strong>${task.name}</strong> is now owned by you.`,
          task.roadblockNote ? `Note: ${task.roadblockNote}` : "",
        ].filter(Boolean),
        path: `/projects/${existing.projectId}/roadblocks`,
      });
    }

    revalidatePath(`/projects/${existing.projectId}/roadblocks`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const resolveRoadblockSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
});

export async function resolveRoadblock(input: unknown): Promise<ActionResult<Task>> {
  const parsed = resolveRoadblockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    // Only Project Manager, Superintendent, or the assigned Trade member may resolve.
    const existing = await requireRoadblockResolveAccess(user.id, parsed.data.taskId);

    const task = await prisma.task.update({
      where: { id: parsed.data.taskId },
      data: { roadblockStatus: "RESOLVED", resolvedAt: new Date() },
    });

    await logActivity({
      projectId: existing.projectId,
      taskId: task.id,
      taskName: task.name,
      userId: user.id,
      action: "roadblock_resolved",
      detail: `Resolved the roadblock on "${task.name}"`,
      entityType: "TASK",
      entityId: task.id,
      changes: activityChanges(existing, task, ["roadblockStatus", "resolvedAt"]),
    });

    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/gantt`);
    revalidatePath(`/projects/${existing.projectId}/dashboard`);
    revalidatePath(`/projects/${existing.projectId}/roadblocks`);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

const deleteTaskSchema = z.object({ taskId: z.string().min(1, "taskId is required") });

export async function deleteTask(input: unknown): Promise<ActionResult<null>> {
  const parsed = deleteTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const existing = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
    if (!existing) throw new Error("Task not found");

    await requireScheduleEditAccess(user.id, existing.projectId);

    await prisma.task.delete({ where: { id: parsed.data.taskId } });

    await logActivity({
      projectId: existing.projectId,
      taskName: existing.name,
      userId: user.id,
      action: "task_deleted",
      detail: `Deleted task "${existing.name}"`,
      entityType: "TASK",
      entityId: existing.id,
      changes: activityChanges(existing, {}, [
        "name",
        "assignedToId",
        "startDate",
        "endDate",
        "status",
        "progress",
      ]),
    });

    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/gantt`);
    revalidatePath(`/projects/${existing.projectId}/dashboard`);
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

const addDependencySchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  predecessorId: z.string().min(1, "predecessorId is required"),
  successorId: z.string().min(1, "successorId is required"),
});

export async function addDependency(input: unknown): Promise<ActionResult<TaskDependency>> {
  const parsed = addDependencySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireScheduleEditAccess(user.id, parsed.data.projectId);

    if (parsed.data.predecessorId === parsed.data.successorId) {
      throw new Error("A task cannot depend on itself");
    }

    const [predecessor, successor] = await Promise.all([
      prisma.task.findUnique({ where: { id: parsed.data.predecessorId } }),
      prisma.task.findUnique({ where: { id: parsed.data.successorId } }),
    ]);
    if (!predecessor || !successor) throw new Error("Task not found");
    if (predecessor.projectId !== parsed.data.projectId || successor.projectId !== parsed.data.projectId) {
      throw new Error("Both tasks must belong to the same project");
    }

    const existingEdges = await prisma.taskDependency.findMany({
      where: { predecessor: { projectId: parsed.data.projectId } },
      select: { predecessorId: true, successorId: true },
    });
    if (wouldCreateCycle(existingEdges, parsed.data.predecessorId, parsed.data.successorId)) {
      throw new Error("That would create a circular dependency");
    }

    const dependency = await prisma.taskDependency.create({
      data: { predecessorId: parsed.data.predecessorId, successorId: parsed.data.successorId },
    });

    await logActivity({
      projectId: parsed.data.projectId,
      taskId: successor.id,
      taskName: successor.name,
      userId: user.id,
      action: "dependency_added",
      detail: `"${successor.name}" now depends on "${predecessor.name}"`,
      entityType: "TASK_DEPENDENCY",
      entityId: dependency.id,
      changes: activityChanges({}, dependency, ["predecessorId", "successorId"]),
    });

    revalidatePath(`/projects/${parsed.data.projectId}/gantt`);
    revalidatePath(`/projects/${parsed.data.projectId}/lookahead`);
    return ok(dependency);
  } catch (error) {
    return fail(error);
  }
}

const removeDependencySchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  dependencyId: z.string().min(1, "dependencyId is required"),
});

export async function removeDependency(input: unknown): Promise<ActionResult<null>> {
  const parsed = removeDependencySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireScheduleEditAccess(user.id, parsed.data.projectId);

    const edge = await requireProjectDependencyReference(
      parsed.data.projectId,
      parsed.data.dependencyId
    );

    await prisma.taskDependency.delete({ where: { id: parsed.data.dependencyId } });

    await logActivity({
      projectId: parsed.data.projectId,
      taskId: edge.successor.id,
      taskName: edge.successor.name,
      userId: user.id,
      action: "dependency_removed",
      detail: `Removed dependency: "${edge.successor.name}" no longer depends on "${edge.predecessor.name}"`,
      entityType: "TASK_DEPENDENCY",
      entityId: edge.id,
      changes: activityChanges(edge, {}, ["predecessorId", "successorId"]),
    });

    revalidatePath(`/projects/${parsed.data.projectId}/gantt`);
    revalidatePath(`/projects/${parsed.data.projectId}/lookahead`);
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
