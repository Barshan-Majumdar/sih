"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireScheduleEditAccess } from "@/lib/permissions";
import { ok, fail, type ActionResult } from "./schemas";
import { normalizeTaskName, parseScheduleCsv } from "@/lib/schedule-csv";
import { wouldCreateCycle } from "@/lib/critical-path";
import { activityChanges, logActivity } from "@/lib/activity-log";

export type ScheduleImportResult = {
  created: number;
  updated: number;
  dependenciesCreated: number;
};

const MAX_CSV_CHARACTERS = 1_000_000;

/** How many offending lines to name before collapsing the rest into a count. */
const MAX_REPORTED_ERROR_LINES = 3;

const importScheduleCsvSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  csvText: z
    .string()
    .min(1, "The file is empty")
    .max(MAX_CSV_CHARACTERS, "That file is too large to import - keep it under 1 MB"),
});

/** A `YYYY-MM-DD` day lands on that calendar day in UTC, matching how task dates are stored. */
function toUtcDate(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

function describeRowErrors(errors: { lineNumber: number; messages: string[] }[]): string {
  const shown = errors
    .slice(0, MAX_REPORTED_ERROR_LINES)
    .map((error) => `Line ${error.lineNumber}: ${error.messages.join("; ")}`)
    .join("; ");
  const remaining = errors.length - Math.min(errors.length, MAX_REPORTED_ERROR_LINES);
  const rowWord = errors.length === 1 ? "row has" : "rows have";
  return `${errors.length} ${rowWord} errors and nothing was imported. ${shown}${
    remaining > 0 ? `; and ${remaining} more` : ""
  }`;
}

/**
 * Bulk-imports a schedule from raw CSV text. Upserts by task name: rows naming
 * an existing task update it, the rest are created, and nothing is deleted.
 * All-or-nothing: if any row fails validation the whole file is rejected.
 */
export async function importScheduleCsv(input: unknown): Promise<ActionResult<ScheduleImportResult>> {
  const parsedInput = importScheduleCsvSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: parsedInput.error.issues.map((i) => i.message).join(", ") };
  }

  const { projectId, csvText } = parsedInput.data;

  try {
    const user = await requireUser();
    await requireScheduleEditAccess(user.id, projectId);

    const [members, existingTasks] = await Promise.all([
      prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.task.findMany({ where: { projectId }, select: { id: true, name: true } }),
    ]);

    // The client already previewed this file, but the client is not trusted:
    // the parse that decides what gets written is this one.
    const parsed = parseScheduleCsv(csvText, {
      members: members.map((member) => ({
        id: member.id,
        email: member.user.email,
        name: member.user.name,
      })),
      existingTasks,
    });

    if (parsed.fatalError) throw new Error(parsed.fatalError);
    if (parsed.errors.length > 0) throw new Error(describeRowErrors(parsed.errors));
    if (parsed.rows.length === 0) throw new Error("That file has no activity rows to import");

    const result = await prisma.$transaction(async (tx) => {
      const maxSequence = await tx.task.aggregate({
        where: { projectId },
        _max: { sequenceOrder: true },
      });
      let nextSequence = (maxSequence._max.sequenceOrder ?? 0) + 1;

      // Normalized task name -> task id, seeded with the tasks already on the
      // project so predecessors may name rows from this file or older tasks.
      const idByName = new Map<string, string>();
      for (const task of existingTasks) idByName.set(normalizeTaskName(task.name), task.id);

      let created = 0;
      let updated = 0;

      for (const row of parsed.rows) {
        const fields = {
          name: row.name,
          assignedToId: row.assigneeMemberId,
          startDate: toUtcDate(row.startDate),
          endDate: toUtcDate(row.endDate),
          status: row.status,
          progress: row.progress,
        };

        if (row.action === "update" && row.existingTaskId) {
          const task = await tx.task.update({ where: { id: row.existingTaskId }, data: fields });
          idByName.set(normalizeTaskName(task.name), task.id);
          updated += 1;
        } else {
          const task = await tx.task.create({
            data: { projectId, sequenceOrder: nextSequence++, ...fields },
          });
          idByName.set(normalizeTaskName(task.name), task.id);
          created += 1;
        }
      }

      // Cycle guard runs against the whole resulting graph: a file that is
      // acyclic on its own can still close a loop through edges already in the
      // database. Adding one edge at a time keeps the accumulated graph acyclic.
      const edges = await tx.taskDependency.findMany({
        where: { predecessor: { projectId } },
        select: { predecessorId: true, successorId: true },
      });
      const edgeKeys = new Set(edges.map((edge) => `${edge.predecessorId}->${edge.successorId}`));

      const newEdges: { predecessorId: string; successorId: string }[] = [];
      for (const row of parsed.rows) {
        const successorId = idByName.get(normalizeTaskName(row.name));
        if (!successorId) throw new Error(`Line ${row.lineNumber}: could not resolve "${row.name}"`);

        for (const predecessorName of row.predecessorNames) {
          const predecessorId = idByName.get(normalizeTaskName(predecessorName));
          if (!predecessorId) {
            throw new Error(
              `Line ${row.lineNumber}: predecessor "${predecessorName}" is not a task on this project`
            );
          }

          const key = `${predecessorId}->${successorId}`;
          if (edgeKeys.has(key)) continue;

          if (wouldCreateCycle(edges, predecessorId, successorId)) {
            throw new Error(
              `Line ${row.lineNumber}: "${predecessorName}" -> "${row.name}" would create a circular dependency, so nothing was imported`
            );
          }

          edgeKeys.add(key);
          edges.push({ predecessorId, successorId });
          newEdges.push({ predecessorId, successorId });
        }
      }

      if (newEdges.length > 0) {
        await tx.taskDependency.createMany({ data: newEdges, skipDuplicates: true });
      }

      return { created, updated, dependenciesCreated: newEdges.length };
    });

    await logActivity({
      projectId,
      userId: user.id,
      action: "schedule_imported",
      detail: `Imported ${parsed.rows.length} activities from CSV (${result.created} new, ${result.updated} updated, ${result.dependenciesCreated} dependencies)`,
      entityType: "SCHEDULE_IMPORT",
      entityId: projectId,
      source: "UI",
      changes: activityChanges({}, result, ["created", "updated", "dependenciesCreated"]),
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/gantt`);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
