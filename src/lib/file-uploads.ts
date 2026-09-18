import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MAX_DRAWING_BYTES = 20 * 1024 * 1024;
export const MAX_FIELD_PHOTO_BYTES = 5 * 1024 * 1024;
export const PROJECT_UPLOAD_LIMIT_BYTES = 500 * 1024 * 1024;
export const ORGANIZATION_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
export const PROJECT_UPLOAD_FILE_LIMIT = 500;
export const ORGANIZATION_UPLOAD_FILE_LIMIT = 5_000;

export type UploadKind = "document" | "drawing" | "photo";

export class UploadPolicyError extends Error {
  constructor(message: string, readonly status: 400 | 409 | 413 | 415) {
    super(message);
    this.name = "UploadPolicyError";
  }
}

export type ValidatedUpload = {
  bytes: Buffer;
  fileName: string;
  mediaType: "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  contentHash: string;
};

const MEDIA_EXTENSIONS: Record<ValidatedUpload["mediaType"], string[]> = {
  "application/pdf": ["pdf"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
};

function uploadLimit(kind: UploadKind): number {
  if (kind === "photo") return MAX_FIELD_PHOTO_BYTES;
  return kind === "drawing" ? MAX_DRAWING_BYTES : MAX_DOCUMENT_BYTES;
}

function uploadLabel(kind: UploadKind): string {
  return kind === "photo" ? "Photo" : kind === "drawing" ? "Drawing" : "File";
}

export function formatUploadBytes(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  if (sizeBytes < 1024 * 1024 * 1024) return `${Math.round(sizeBytes / (1024 * 1024))} MB`;
  return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function sanitizeUploadFileName(originalName: string): string {
  const leaf = originalName.normalize("NFKC").replace(/\\/g, "/").split("/").at(-1) ?? "";
  const cleaned = leaf
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!cleaned || !cleaned.includes(".")) {
    throw new UploadPolicyError("Use a file name with a supported extension.", 415);
  }
  if (cleaned.length <= 180) return cleaned;
  const extension = cleaned.split(".").at(-1)!;
  return `${cleaned.slice(0, Math.max(1, 179 - extension.length)).trim()}.${extension}`;
}

export function detectUploadMediaType(bytes: Uint8Array): ValidatedUpload["mediaType"] | null {
  if (bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value
    )
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function validateUploadBytes(input: {
  bytes: Buffer;
  fileName: string;
  declaredMediaType?: string | null;
  kind: UploadKind;
}): ValidatedUpload {
  const fileName = sanitizeUploadFileName(input.fileName);
  const sizeBytes = input.bytes.byteLength;
  const label = uploadLabel(input.kind);
  const maxBytes = uploadLimit(input.kind);
  if (sizeBytes === 0) throw new UploadPolicyError(`Choose a ${label.toLowerCase()} to upload.`, 400);
  if (sizeBytes > maxBytes) {
    throw new UploadPolicyError(`${label}s must be ${formatUploadBytes(maxBytes)} or smaller.`, 413);
  }

  const mediaType = detectUploadMediaType(input.bytes);
  if (!mediaType || (input.kind === "photo" && mediaType === "application/pdf")) {
    throw new UploadPolicyError(
      input.kind === "photo"
        ? "The photo contents must be PNG, JPEG, or WebP."
        : "The file contents must be PDF, PNG, JPEG, or WebP.",
      415
    );
  }

  const declaredMediaType = input.declaredMediaType?.split(";", 1)[0].trim().toLowerCase();
  if (declaredMediaType && declaredMediaType !== "application/octet-stream" && declaredMediaType !== mediaType) {
    throw new UploadPolicyError(
      `The file contents do not match the declared ${declaredMediaType} type.`,
      415
    );
  }

  const extension = fileName.split(".").at(-1)!.toLowerCase();
  if (!MEDIA_EXTENSIONS[mediaType].includes(extension)) {
    throw new UploadPolicyError(
      `The .${extension} extension does not match the detected ${mediaType} contents.`,
      415
    );
  }

  return {
    bytes: input.bytes,
    fileName,
    mediaType,
    sizeBytes,
    contentHash: createHash("sha256").update(input.bytes).digest("hex"),
  };
}

export async function validateUploadedFile(file: File, kind: UploadKind): Promise<ValidatedUpload> {
  if (file.size === 0) {
    throw new UploadPolicyError(`Choose a ${uploadLabel(kind).toLowerCase()} to upload.`, 400);
  }
  const maxBytes = uploadLimit(kind);
  if (file.size > maxBytes) {
    throw new UploadPolicyError(
      `${uploadLabel(kind)}s must be ${formatUploadBytes(maxBytes)} or smaller.`,
      413
    );
  }
  return validateUploadBytes({
    bytes: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
    declaredMediaType: file.type,
    kind,
  });
}

function summedSize(...values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function assertUploadQuotaAvailable(input: {
  duplicateName?: string | null;
  projectCount: number;
  organizationCount: number;
  projectBytes: number;
  organizationBytes: number;
  uploadSizeBytes: number;
}) {
  if (input.duplicateName) {
    throw new UploadPolicyError(
      `This exact file is already stored in the project as "${input.duplicateName}".`,
      409
    );
  }
  if (input.projectCount + 1 > PROJECT_UPLOAD_FILE_LIMIT) {
    throw new UploadPolicyError(
      `This project has reached its ${PROJECT_UPLOAD_FILE_LIMIT.toLocaleString()}-file storage limit.`,
      413
    );
  }
  if (input.organizationCount + 1 > ORGANIZATION_UPLOAD_FILE_LIMIT) {
    throw new UploadPolicyError(
      `This organization has reached its ${ORGANIZATION_UPLOAD_FILE_LIMIT.toLocaleString()}-file storage limit.`,
      413
    );
  }
  if (input.projectBytes + input.uploadSizeBytes > PROJECT_UPLOAD_LIMIT_BYTES) {
    throw new UploadPolicyError(
      `This upload would exceed the project's ${formatUploadBytes(PROJECT_UPLOAD_LIMIT_BYTES)} storage limit.`,
      413
    );
  }
  if (input.organizationBytes + input.uploadSizeBytes > ORGANIZATION_UPLOAD_LIMIT_BYTES) {
    throw new UploadPolicyError(
      `This upload would exceed the organization's ${formatUploadBytes(ORGANIZATION_UPLOAD_LIMIT_BYTES)} storage limit.`,
      413
    );
  }
}

export async function enforceUploadQuota(input: {
  organizationId: string;
  projectId: string;
  upload: Pick<ValidatedUpload, "contentHash" | "sizeBytes">;
}) {
  const projectDocuments = { projectId: input.projectId };
  const organizationDocuments = { project: { organizationId: input.organizationId } };
  const projectPhotos = { photoUrl: { not: null }, task: { projectId: input.projectId } };
  const organizationPhotos = {
    photoUrl: { not: null },
    task: { project: { organizationId: input.organizationId } },
  };

  const [
    projectDocumentUsage,
    projectDrawingUsage,
    projectPhotoUsage,
    organizationDocumentUsage,
    organizationDrawingUsage,
    organizationPhotoUsage,
    duplicateDocument,
    duplicateDrawing,
    duplicatePhoto,
  ] = await prisma.$transaction([
    prisma.assistantAttachment.aggregate({ where: projectDocuments, _sum: { sizeBytes: true }, _count: { id: true } }),
    prisma.drawing.aggregate({ where: { projectId: input.projectId }, _sum: { sizeBytes: true }, _count: { id: true } }),
    prisma.taskUpdate.aggregate({ where: projectPhotos, _sum: { sizeBytes: true }, _count: { id: true } }),
    prisma.assistantAttachment.aggregate({ where: organizationDocuments, _sum: { sizeBytes: true }, _count: { id: true } }),
    prisma.drawing.aggregate({ where: { project: { organizationId: input.organizationId } }, _sum: { sizeBytes: true }, _count: { id: true } }),
    prisma.taskUpdate.aggregate({ where: organizationPhotos, _sum: { sizeBytes: true }, _count: { id: true } }),
    prisma.assistantAttachment.findFirst({ where: { projectId: input.projectId, contentHash: input.upload.contentHash }, select: { fileName: true } }),
    prisma.drawing.findFirst({ where: { projectId: input.projectId, contentHash: input.upload.contentHash }, select: { fileName: true, title: true } }),
    prisma.taskUpdate.findFirst({ where: { task: { projectId: input.projectId }, contentHash: input.upload.contentHash }, select: { fileName: true } }),
  ]);

  const duplicateName =
    duplicateDocument?.fileName ?? duplicateDrawing?.fileName ?? duplicateDrawing?.title ?? duplicatePhoto?.fileName;
  const projectCount =
    projectDocumentUsage._count.id + projectDrawingUsage._count.id + projectPhotoUsage._count.id;
  const organizationCount =
    organizationDocumentUsage._count.id +
    organizationDrawingUsage._count.id +
    organizationPhotoUsage._count.id;
  const projectBytes = summedSize(
    projectDocumentUsage._sum.sizeBytes,
    projectDrawingUsage._sum.sizeBytes,
    projectPhotoUsage._sum.sizeBytes
  );
  const organizationBytes = summedSize(
    organizationDocumentUsage._sum.sizeBytes,
    organizationDrawingUsage._sum.sizeBytes,
    organizationPhotoUsage._sum.sizeBytes
  );

  assertUploadQuotaAvailable({
    duplicateName,
    projectCount,
    organizationCount,
    projectBytes,
    organizationBytes,
    uploadSizeBytes: input.upload.sizeBytes,
  });
}
