import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireStoredFileAccess } from "@/lib/file-access";
import { recordFileAccess } from "@/lib/file-access-audit";
import { PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

describe("private file authorization", () => {
  let fixture: Fixture;
  let outsiderId: string;

  beforeAll(async () => {
    fixture = await createFixture();
    const outsider = await prisma.user.create({
      data: {
        name: "Storage outsider",
        email: `storage-outsider-${Date.now()}@test.local`,
        emailVerified: true,
      },
    });
    outsiderId = outsider.id;
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
    await prisma.user.delete({ where: { id: outsiderId } }).catch(() => {});
  });

  it("allows project members to read project and task objects", async () => {
    const task = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Storage authorization task",
        startDate: new Date("2026-08-01T12:00:00.000Z"),
        endDate: new Date("2026-08-02T12:00:00.000Z"),
      },
    });
    await expect(
      requireStoredFileAccess(
        fixture.trade.user.id,
        `drawings/${fixture.project.id}/plan.pdf`
      )
    ).resolves.toMatchObject({ projectId: fixture.project.id });
    await expect(
      requireStoredFileAccess(fixture.trade.user.id, `tasks/${task.id}/photo.jpg`)
    ).resolves.toMatchObject({ projectId: fixture.project.id });
  });

  it("denies users outside the project", async () => {
    await expect(
      requireStoredFileAccess(outsiderId, `documents/${fixture.project.id}/spec.pdf`)
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("deduplicates views while retaining every download and denied attempt", async () => {
    const storageKey = `documents/${fixture.project.id}/audit-report.pdf`;
    const common = {
      organizationId: fixture.organization.id,
      projectId: fixture.project.id,
      projectName: fixture.project.name,
      userId: fixture.trade.user.id,
      userName: fixture.trade.user.name,
      storageKey,
      fileName: "audit-report.pdf",
      rangeHeader: "bytes=0-7",
      userAgent: "Agira integration test",
      now: new Date("2026-07-18T12:00:00.000Z"),
    };

    await recordFileAccess({ ...common, action: "VIEW", outcome: "ALLOWED" });
    await recordFileAccess({ ...common, action: "VIEW", outcome: "ALLOWED" });
    await recordFileAccess({ ...common, action: "DOWNLOAD", outcome: "ALLOWED" });
    await recordFileAccess({ ...common, action: "DOWNLOAD", outcome: "ALLOWED" });
    await recordFileAccess({
      ...common,
      userId: outsiderId,
      userName: "Storage outsider",
      action: "VIEW",
      outcome: "DENIED",
      denialReason: "Project membership required",
    });

    const records = await prisma.fileAccessAuditEntry.findMany({
      where: { projectId: fixture.project.id, storageKey },
      orderBy: { createdAt: "asc" },
    });
    expect(records).toHaveLength(4);
    expect(records.filter((record) => record.action === "VIEW" && record.outcome === "ALLOWED")).toHaveLength(1);
    expect(records.filter((record) => record.action === "DOWNLOAD")).toHaveLength(2);
    expect(records.find((record) => record.outcome === "DENIED")?.denialReason).toBe(
      "Project membership required"
    );
  });
});
