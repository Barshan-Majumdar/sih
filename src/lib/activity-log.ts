import { prisma } from "@/lib/prisma";
import type { ActivitySource, Prisma } from "@prisma/client";

export type ActivityChangeValue = string | number | boolean | null;
export type ActivityChanges = Record<
  string,
  { before: ActivityChangeValue; after: ActivityChangeValue }
>;

function normalizeActivityValue(value: unknown): ActivityChangeValue {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

/** Builds a compact before/after object and omits fields that did not change. */
export function activityChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[]
): ActivityChanges | undefined {
  const changes: ActivityChanges = {};
  for (const field of fields) {
    const previous = normalizeActivityValue(before[field]);
    const next = normalizeActivityValue(after[field]);
    if (previous !== next) changes[field] = { before: previous, after: next };
  }
  return Object.keys(changes).length > 0 ? changes : undefined;
}

/**
 * Append-only audit trail for schedule-relevant changes. Never throws —
 * a logging failure should never break the mutation it's describing.
 */
export async function logActivity(params: {
  projectId: string;
  taskId?: string | null;
  taskName?: string | null;
  userId: string;
  action: string;
  detail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  source?: ActivitySource;
  changes?: ActivityChanges;
}) {
  try {
    await prisma.activityLogEntry.create({
      data: {
        projectId: params.projectId,
        taskId: params.taskId ?? null,
        taskName: params.taskName ?? null,
        userId: params.userId,
        action: params.action,
        detail: params.detail ?? null,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        source: params.source ?? "UI",
        changes: params.changes as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Best-effort logging; swallow errors so the underlying action still succeeds.
  }
}
