import { describe, expect, it } from "vitest";
import {
  assertUploadQuotaAvailable,
  detectUploadMediaType,
  ORGANIZATION_UPLOAD_LIMIT_BYTES,
  ORGANIZATION_UPLOAD_FILE_LIMIT,
  PROJECT_UPLOAD_LIMIT_BYTES,
  PROJECT_UPLOAD_FILE_LIMIT,
  sanitizeUploadFileName,
  UploadPolicyError,
  validateUploadBytes,
} from "@/lib/file-uploads";

const pdf = Buffer.from("%PDF-1.4\nAgira\n%%EOF");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe("file upload validation", () => {
  it("detects supported file signatures instead of trusting MIME strings", () => {
    expect(detectUploadMediaType(pdf)).toBe("application/pdf");
    expect(detectUploadMediaType(png)).toBe("image/png");
    expect(detectUploadMediaType(Buffer.from("not a file"))).toBeNull();
  });

  it("normalizes unsafe path-like file names", () => {
    expect(sanitizeUploadFileName("../../A-101: floor plan.pdf")).toBe(
      "A-101_ floor plan.pdf"
    );
  });

  it("rejects a renamed non-PDF payload", () => {
    expect(() =>
      validateUploadBytes({
        bytes: Buffer.from("plain text"),
        fileName: "report.pdf",
        declaredMediaType: "application/pdf",
        kind: "document",
      })
    ).toThrowError(UploadPolicyError);
  });

  it("rejects extension and declared MIME mismatches", () => {
    expect(() =>
      validateUploadBytes({
        bytes: pdf,
        fileName: "report.png",
        declaredMediaType: "application/pdf",
        kind: "document",
      })
    ).toThrow("extension does not match");
    expect(() =>
      validateUploadBytes({
        bytes: pdf,
        fileName: "report.pdf",
        declaredMediaType: "image/png",
        kind: "document",
      })
    ).toThrow("do not match");
  });

  it("produces a stable content hash for duplicate detection", () => {
    const first = validateUploadBytes({
      bytes: pdf,
      fileName: "report.pdf",
      declaredMediaType: "application/pdf",
      kind: "document",
    });
    const second = validateUploadBytes({
      bytes: pdf,
      fileName: "renamed.pdf",
      declaredMediaType: "application/pdf",
      kind: "document",
    });
    expect(first.contentHash).toHaveLength(64);
    expect(second.contentHash).toBe(first.contentHash);
  });

  it("enforces the smaller field-photo limit", () => {
    const oversizedPhoto = Buffer.alloc(5 * 1024 * 1024 + 1);
    oversizedPhoto.set(png);

    expect(() =>
      validateUploadBytes({
        bytes: oversizedPhoto,
        fileName: "field-progress.png",
        declaredMediaType: "image/png",
        kind: "photo",
      })
    ).toThrow("Photos must be 5 MB or smaller");
  });

  it("rejects duplicate content and exhausted project quotas", () => {
    expect(() =>
      assertUploadQuotaAvailable({
        duplicateName: "report.pdf",
        projectCount: 1,
        organizationCount: 1,
        projectBytes: 1,
        organizationBytes: 1,
        uploadSizeBytes: 1,
      })
    ).toThrow('already stored in the project as "report.pdf"');

    expect(() =>
      assertUploadQuotaAvailable({
        projectCount: PROJECT_UPLOAD_FILE_LIMIT,
        organizationCount: PROJECT_UPLOAD_FILE_LIMIT,
        projectBytes: 0,
        organizationBytes: 0,
        uploadSizeBytes: 1,
      })
    ).toThrow("500-file storage limit");

    expect(() =>
      assertUploadQuotaAvailable({
        projectCount: 0,
        organizationCount: 0,
        projectBytes: PROJECT_UPLOAD_LIMIT_BYTES,
        organizationBytes: PROJECT_UPLOAD_LIMIT_BYTES,
        uploadSizeBytes: 1,
      })
    ).toThrow("project's 500 MB storage limit");
  });

  it("rejects exhausted organization quotas", () => {
    expect(() =>
      assertUploadQuotaAvailable({
        projectCount: 0,
        organizationCount: ORGANIZATION_UPLOAD_FILE_LIMIT,
        projectBytes: 0,
        organizationBytes: 0,
        uploadSizeBytes: 1,
      })
    ).toThrow("5,000-file storage limit");

    expect(() =>
      assertUploadQuotaAvailable({
        projectCount: 0,
        organizationCount: 0,
        projectBytes: 0,
        organizationBytes: ORGANIZATION_UPLOAD_LIMIT_BYTES,
        uploadSizeBytes: 1,
      })
    ).toThrow("organization's 5.0 GB storage limit");
  });
});
