import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

describe("structured project activity audit", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it("persists entity, source, and before/after metadata", async () => {
    await logActivity({
      projectId: fixture.project.id,
      userId: fixture.pm.user.id,
      action: "test_task_status_changed",
      detail: "Changed a task status for the activity audit test",
      entityType: "TASK",
      entityId: "test-task-1",
      source: "AGENT",
      changes: activityChanges(
        { status: "NOT_STARTED", progress: 0 },
        { status: "IN_PROGRESS", progress: 25 },
        ["status", "progress"]
      ),
    });

    const entry = await prisma.activityLogEntry.findFirstOrThrow({
      where: { projectId: fixture.project.id, action: "test_task_status_changed" },
    });
    expect(entry).toMatchObject({
      entityType: "TASK",
      entityId: "test-task-1",
      source: "AGENT",
      changes: {
        status: { before: "NOT_STARTED", after: "IN_PROGRESS" },
        progress: { before: 0, after: 25 },
      },
    });
  });

  it("defaults normal project changes to UI and supports source filtering", async () => {
    await logActivity({
      projectId: fixture.project.id,
      userId: fixture.superintendent.user.id,
      action: "test_ui_event",
      entityType: "TASK_UPDATE",
      entityId: "test-update-1",
    });
    await logActivity({
      projectId: fixture.project.id,
      userId: fixture.pm.user.id,
      action: "test_system_event",
      entityType: "TASK",
      entityId: "test-task-2",
      source: "SYSTEM",
    });

    const uiEntry = await prisma.activityLogEntry.findFirstOrThrow({
      where: { projectId: fixture.project.id, action: "test_ui_event" },
    });
    expect(uiEntry.source).toBe("UI");

    const automaticEntries = await prisma.activityLogEntry.findMany({
      where: { projectId: fixture.project.id, source: { in: ["AGENT", "SYSTEM"] } },
      orderBy: { createdAt: "asc" },
    });
    expect(automaticEntries.map((entry) => entry.action)).toEqual([
      "test_task_status_changed",
      "test_system_event",
    ]);
  });
});
