import { describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import { storageScopeForKey } from "@/lib/file-access";
import {
  isDurableStorageConfigured,
  normalizeStorageKey,
  privateStoredFileUrl,
  readStoredFile,
  storageFileUrl,
  uploadFile,
} from "@/lib/storage";

describe("private storage keys", () => {
  it("builds authenticated URLs without exposing a bucket URL", () => {
    expect(storageFileUrl("drawings/project-1/plan set.pdf")).toBe(
      "/api/files/drawings/project-1/plan%20set.pdf"
    );
  });

  it("protects legacy local upload URLs", () => {
    expect(privateStoredFileUrl("/uploads/tasks/task-1/photo.jpg")).toBe(
      "/api/files/tasks/task-1/photo.jpg"
    );
  });

  it("rejects traversal and malformed paths", () => {
    expect(() => normalizeStorageKey("../secret.pdf")).toThrow("Invalid storage key");
    expect(() => normalizeStorageKey("drawings//secret.pdf")).toThrow("Invalid storage key");
    expect(() => normalizeStorageKey("drawings/project/../../secret.pdf")).toThrow(
      "Invalid storage key"
    );
  });

  it("derives authorization scope from supported object paths", () => {
    expect(storageScopeForKey("drawings/project-1/file.pdf")).toEqual({
      kind: "PROJECT",
      projectId: "project-1",
    });
    expect(storageScopeForKey("documents/project-2/spec.pdf")).toEqual({
      kind: "PROJECT",
      projectId: "project-2",
    });
    expect(storageScopeForKey("tasks/task-1/photo.jpg")).toEqual({
      kind: "TASK",
      taskId: "task-1",
    });
    expect(() => storageScopeForKey("misc/project-1/file.pdf")).toThrow(
      "Unsupported storage path"
    );
  });

  it.skipIf(isDurableStorageConfigured())(
    "streams complete and ranged files from the development backend",
    async () => {
      const key = `tasks/storage-test/fixture-${Date.now()}.pdf`;
      const localPath = path.join(process.cwd(), "public", "uploads", ...key.split("/"));
      try {
        await expect(uploadFile(key, Buffer.from("0123456789"), "application/pdf")).resolves.toBe(
          storageFileUrl(key)
        );
        await expect(readStoredFile(key)).resolves.toMatchObject({
          contentType: "application/pdf",
          contentLength: 10,
          contentRange: null,
        });
        const partial = await readStoredFile(key, "bytes=2-5");
        expect(Buffer.from(partial.bytes).toString()).toBe("2345");
        expect(partial).toMatchObject({
          contentLength: 4,
          contentRange: "bytes 2-5/10",
          totalLength: 10,
        });
      } finally {
        await rm(localPath, { force: true });
      }
    }
  );
});
