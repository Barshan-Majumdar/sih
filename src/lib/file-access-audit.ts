import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type FileAccessActionValue = "VIEW" | "DOWNLOAD";
export type FileAccessOutcomeValue = "ALLOWED" | "DENIED";

const VIEW_DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const DENIED_DEDUPE_WINDOW_MS = 60 * 1000;

function trimmedHeader(value: string | null, maxLength = 500): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export function fileAccessAction(requestUrl: string): FileAccessActionValue {
  return new URL(requestUrl).searchParams.get("download") === "1" ? "DOWNLOAD" : "VIEW";
}

export function fileAccessDedupeKey(input: {
  userId?: string | null;
  projectId: string;
  storageKey: string;
  action: FileAccessActionValue;
  outcome: FileAccessOutcomeValue;
  now?: Date;
}): string | null {
  if (input.action === "DOWNLOAD" && input.outcome === "ALLOWED") return null;
  const windowMs = input.outcome === "DENIED" ? DENIED_DEDUPE_WINDOW_MS : VIEW_DEDUPE_WINDOW_MS;
  const bucket = Math.floor((input.now ?? new Date()).getTime() / windowMs);
  return createHash("sha256")
    .update(
      [
        input.userId ?? "anonymous",
        input.projectId,
        input.storageKey,
        input.action,
        input.outcome,
        bucket,
      ].join("|")
    )
    .digest("hex");
}

export async function recordFileAccess(input: {
  organizationId: string;
  projectId: string;
  projectName: string;
  userId?: string | null;
  userName?: string | null;
  storageKey: string;
  fileName?: string;
  action: FileAccessActionValue;
  outcome: FileAccessOutcomeValue;
  rangeHeader?: string | null;
  userAgent?: string | null;
  denialReason?: string | null;
  now?: Date;
}) {
  const fileName = input.fileName ?? input.storageKey.split("/").at(-1) ?? "file";
  try {
    await prisma.fileAccessAuditEntry.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        projectName: input.projectName,
        userId: input.userId ?? null,
        userName: trimmedHeader(input.userName ?? null, 200),
        storageKey: input.storageKey,
        fileName,
        action: input.action,
        outcome: input.outcome,
        rangeRequested: Boolean(input.rangeHeader),
        userAgent: trimmedHeader(input.userAgent ?? null),
        denialReason: trimmedHeader(input.denialReason ?? null),
        dedupeKey: fileAccessDedupeKey(input),
        createdAt: input.now,
      },
    });
  } catch {
    // Auditing is best-effort: duplicate view buckets and audit outages must not block files.
  }
}
