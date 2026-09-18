import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/permissions";
import { normalizeStorageKey } from "@/lib/storage";

export type StorageScope =
  | { kind: "PROJECT"; projectId: string }
  | { kind: "TASK"; taskId: string };

export type StoredFileAccessContext = {
  organizationId: string;
  projectId: string;
  projectName: string;
  fileName: string;
};

export function storageScopeForKey(key: string): StorageScope {
  const parts = normalizeStorageKey(key).split("/");
  if (parts[0] === "drawings" && parts[1]) {
    return { kind: "PROJECT", projectId: parts[1] };
  }
  if (parts[0] === "documents" && parts[1]) {
    return { kind: "PROJECT", projectId: parts[1] };
  }
  if (parts[0] === "tasks" && parts[1]) {
    return { kind: "TASK", taskId: parts[1] };
  }
  throw new Error("Unsupported storage path");
}

export async function storedFileAccessContext(key: string): Promise<StoredFileAccessContext> {
  const scope = storageScopeForKey(key);
  const fallbackFileName = normalizeStorageKey(key).split("/").at(-1) ?? "file";
  if (scope.kind === "PROJECT") {
    const [project, attachment, drawing] = await Promise.all([
      prisma.project.findUnique({
        where: { id: scope.projectId },
        select: { id: true, name: true, organizationId: true },
      }),
      prisma.assistantAttachment.findFirst({
        where: { OR: [{ storageKey: key }, { searchableStorageKey: key }] },
        select: { fileName: true },
      }),
      prisma.drawing.findUnique({
        where: { storageKey: key },
        select: { fileName: true },
      }),
    ]);
    if (!project) throw new Error("File not found");
    return {
      organizationId: project.organizationId,
      projectId: project.id,
      projectName: project.name,
      fileName: attachment?.fileName ?? drawing?.fileName ?? fallbackFileName,
    };
  }
  const [task, update] = await Promise.all([
    prisma.task.findUnique({
      where: { id: scope.taskId },
      select: {
        project: { select: { id: true, name: true, organizationId: true } },
      },
    }),
    prisma.taskUpdate.findUnique({
      where: { storageKey: key },
      select: { fileName: true },
    }),
  ]);
  if (!task) throw new Error("File not found");
  return {
    organizationId: task.project.organizationId,
    projectId: task.project.id,
    projectName: task.project.name,
    fileName: update?.fileName ?? fallbackFileName,
  };
}

export async function requireStoredFileAccess(
  userId: string,
  key: string,
  context?: StoredFileAccessContext
): Promise<StoredFileAccessContext> {
  const resolvedContext = context ?? (await storedFileAccessContext(key));
  await requireProjectMember(userId, resolvedContext.projectId);
  return resolvedContext;
}
