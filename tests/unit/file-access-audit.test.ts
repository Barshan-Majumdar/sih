import { describe, expect, it } from "vitest";
import {
  fileAccessAction,
  fileAccessDedupeKey,
} from "@/lib/file-access-audit";

describe("file access auditing", () => {
  it("classifies inline views and explicit downloads", () => {
    expect(fileAccessAction("https://agira.test/api/files/report.pdf")).toBe("VIEW");
    expect(
      fileAccessAction("https://agira.test/api/files/report.pdf?download=1")
    ).toBe("DOWNLOAD");
  });

  it("deduplicates repeated logical views within a five-minute window", () => {
    const input = {
      userId: "user-1",
      projectId: "project-1",
      storageKey: "documents/project-1/report.pdf",
      action: "VIEW" as const,
      outcome: "ALLOWED" as const,
    };
    const first = fileAccessDedupeKey({ ...input, now: new Date("2026-07-18T12:00:00Z") });
    const repeated = fileAccessDedupeKey({ ...input, now: new Date("2026-07-18T12:04:59Z") });
    const later = fileAccessDedupeKey({ ...input, now: new Date("2026-07-18T12:05:00Z") });

    expect(first).toBe(repeated);
    expect(later).not.toBe(first);
  });

  it("records every allowed download without a dedupe key", () => {
    expect(
      fileAccessDedupeKey({
        userId: "user-1",
        projectId: "project-1",
        storageKey: "documents/project-1/report.pdf",
        action: "DOWNLOAD",
        outcome: "ALLOWED",
      })
    ).toBeNull();
  });
});
