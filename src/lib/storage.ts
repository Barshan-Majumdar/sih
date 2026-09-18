import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

/**
 * Private file storage for field photos, drawings, and assistant documents.
 * Production uses a private Cloudflare R2 bucket; local development falls
 * back to public/uploads, but new URLs are still served through the
 * authenticated /api/files route.
 */

const r2Configured = !!(
  env.R2_ACCOUNT_ID &&
  env.R2_ACCESS_KEY_ID &&
  env.R2_SECRET_ACCESS_KEY &&
  env.R2_BUCKET
);

function r2Endpoint(): string {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

let r2Client: S3Client | null = null;
function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint(),
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2Client;
}

export function isDurableStorageConfigured(): boolean {
  return r2Configured;
}

export function normalizeStorageKey(value: string): string {
  const key = value.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = key.split("/");
  if (
    !key ||
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        part.includes("\0") ||
        part.includes(":")
    )
  ) {
    throw new Error("Invalid storage key");
  }
  return parts.join("/");
}

export function storageFileUrl(key: string): string {
  const normalized = normalizeStorageKey(key);
  return `/api/files/${normalized.split("/").map(encodeURIComponent).join("/")}`;
}

/** Converts legacy public/local upload URLs to the authenticated file route. */
export function privateStoredFileUrl(storedUrl: string): string {
  if (storedUrl.startsWith("/api/files/")) return storedUrl;
  if (storedUrl.startsWith("/uploads/")) {
    return storageFileUrl(storedUrl.slice("/uploads/".length));
  }

  const bases = [
    env.R2_PUBLIC_URL,
    env.R2_ACCOUNT_ID && env.R2_BUCKET ? `${r2Endpoint()}/${env.R2_BUCKET}` : undefined,
  ].filter((base): base is string => Boolean(base));
  for (const base of bases) {
    const normalizedBase = base.replace(/\/$/, "");
    if (storedUrl.startsWith(`${normalizedBase}/`)) {
      return storageFileUrl(decodeURIComponent(storedUrl.slice(normalizedBase.length + 1)));
    }
  }
  return storedUrl;
}

export async function uploadFile(
  key: string,
  bytes: Buffer,
  contentType: string
): Promise<string> {
  const normalized = normalizeStorageKey(key);
  if (r2Configured) {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET!,
        Key: normalized,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "private, no-store",
      })
    );
    return storageFileUrl(normalized);
  }

  const relativeParts = normalized.split("/");
  const dir = path.join(process.cwd(), "public", "uploads", ...relativeParts.slice(0, -1));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, relativeParts.at(-1)!), bytes);
  return storageFileUrl(normalized);
}

export type StoredFile = {
  bytes: Uint8Array;
  contentType: string;
  contentLength: number;
  contentRange: string | null;
  totalLength: number;
};

export class InvalidStorageRangeError extends Error {
  constructor(public readonly totalLength?: number) {
    super("Invalid byte range");
  }
}

function localRange(rangeHeader: string | null, totalLength: number) {
  if (!rangeHeader) return { start: 0, end: totalLength - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2]) || totalLength === 0) {
    throw new InvalidStorageRangeError(totalLength);
  }

  let start: number;
  let end: number;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      throw new InvalidStorageRangeError(totalLength);
    }
    start = Math.max(0, totalLength - suffixLength);
    end = totalLength - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : totalLength - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= totalLength ||
    end < start
  ) {
    throw new InvalidStorageRangeError(totalLength);
  }
  return { start, end: Math.min(end, totalLength - 1), partial: true };
}

function validatedR2Range(rangeHeader: string | null): string | undefined {
  if (!rangeHeader) return undefined;
  if (!/^bytes=(\d*)-(\d*)$/.test(rangeHeader.trim())) {
    throw new InvalidStorageRangeError();
  }
  return rangeHeader.trim();
}

export async function readStoredFile(
  key: string,
  rangeHeader: string | null = null
): Promise<StoredFile> {
  const normalized = normalizeStorageKey(key);
  if (r2Configured) {
    const response = await getR2Client().send(
      new GetObjectCommand({
        Bucket: env.R2_BUCKET!,
        Key: normalized,
        Range: validatedR2Range(rangeHeader),
      })
    );
    if (!response.Body) throw new Error("Stored file is empty");
    const bytes = await response.Body.transformToByteArray();
    const contentRange = response.ContentRange ?? null;
    const totalLength = contentRange
      ? Number(contentRange.split("/").at(-1))
      : response.ContentLength ?? bytes.byteLength;
    return {
      bytes,
      contentType: response.ContentType ?? "application/octet-stream",
      contentLength: response.ContentLength ?? bytes.byteLength,
      contentRange,
      totalLength,
    };
  }

  const filePath = path.join(process.cwd(), "public", "uploads", ...normalized.split("/"));
  const fileStat = await stat(filePath);
  const range = localRange(rangeHeader, fileStat.size);
  const file = await readFile(filePath);
  const bytes = file.subarray(range.start, range.end + 1);
  return {
    bytes,
    contentType: contentTypeForKey(normalized),
    contentLength: bytes.byteLength,
    contentRange: range.partial ? `bytes ${range.start}-${range.end}/${fileStat.size}` : null,
    totalLength: fileStat.size,
  };
}

export async function deleteStoredFile(key: string): Promise<void> {
  const normalized = normalizeStorageKey(key);
  if (r2Configured) {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: normalized })
    );
    return;
  }
  const filePath = path.join(process.cwd(), "public", "uploads", ...normalized.split("/"));
  await rm(filePath, { force: true });
}

function contentTypeForKey(key: string): string {
  const extension = path.extname(key).toLowerCase();
  return {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  }[extension] ?? "application/octet-stream";
}

/** Builds a collision-resistant storage key from a user-provided filename. */
export function buildStorageKey(prefix: string, originalFilename: string): string {
  const safeName = originalFilename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return normalizeStorageKey(`${prefix}/${Date.now()}-${safeName}`);
}
