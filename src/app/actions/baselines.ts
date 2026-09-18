"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireScheduleEditAccess } from "@/lib/permissions";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { ok, fail, type ActionResult } from "./schemas";
import type { Baseline } from "@prisma/client";

const createBaselineSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  name: z.string().min(1, "Name is required").max(200),
});

/** Snapshots every task's current start/end/status so it can be compared against later. */
export async function createBaseline(input: unknown): Promise<ActionResult<Baseline>> {
  const parsed = createBaselineSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireScheduleEditAccess(user.id, parsed.data.projectId);

    const creator = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: parsed.data.projectId, userId: user.id } },
    });

    const tasks = await prisma.task.findMany({ where: { projectId: parsed.data.projectId } });
    if (tasks.length === 0) {
      throw new Error("Add some tasks before creating a baseline");
    }

    const baseline = await prisma.baseline.create({
      data: {
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        createdById: creator.id,
        snapshots: {
          create: tasks.map((t) => ({
            taskId: t.id,
            taskName: t.name,
            startDate: t.startDate,
            endDate: t.endDate,
            status: t.status,
          })),
        },
      },
    });

    await logActivity({
      projectId: parsed.data.projectId,
      userId: user.id,
      action: "baseline_created",
      detail: `Created baseline "${baseline.name}" with ${tasks.length} task snapshots`,
      entityType: "BASELINE",
      entityId: baseline.id,
      changes: activityChanges({}, baseline, ["name", "createdById"]),
    });

    revalidatePath(`/projects/${parsed.data.projectId}/baselines`);
    return ok(baseline);
  } catch (error) {
    return fail(error);
  }
}
